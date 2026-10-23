import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { InquiryNotTransitionableError, QuotationExpiredError } from '../../../inquiries/domain/inquiry-errors';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RentalCreationGuard } from '../services/rental-creation.guard';
import {
  RentalInquiryCustomerMismatchError,
  RentalInquiryNotFoundError,
  RentalInquiryRequiredError,
  RentalInquiryVehicleMismatchError,
} from '../../domain/rental-errors';
import { CreateRentalCommand } from './create-rental.command';

/**
 * ALQ-01 / ALQ-02 - Crear Alquiler directo.
 * TDD-03-alquiler.md seccion 8.2 / SDD seccion 10.
 *
 * Russbel 22-oct-2026 (decision 1; BR-CON-003, EX-CON-001, DEC-CON-001-FINAL): la Consulta es el unico punto de entrada.
 * `inquiryId` es OBLIGATORIO (422 INQUIRY_REQUIRED) y este camino equivale a `convert-to-rental`: la consulta debe estar
 * COTIZADA con cotizacion vigente (409 QUOTATION_EXPIRED), el cliente y el vehiculo deben ser los de la consulta/cotizacion
 * y la consulta pasa a CONVERTIDA en la misma transaccion (antes quedaba COTIZADA y podia convertirse tambien en reserva).
 * El camino canonico sigue siendo `POST /inquiries/{id}/commands/convert-to-rental`; Reserva -> Alquiler usa
 * `POST /rentals/from-reservation/{id}`.
 *
 * Endurecimiento (flujo Consulta -> Alquiler directo, BR-CON-002/003):
 * - cliente ROJO -> 422 CUSTOMER_BLOCKED (el AMBAR no bloquea);
 * - vehiculo AVAILABLE, de la misma sede y sin solape con reservas o
 *   compromisos -> 409 VEHICLE_NOT_AVAILABLE;
 * - `inquiryId`, si llega, debe existir en la misma empresa y estar COTIZADA
 *   (404 INQUIRY_NOT_FOUND / 422 INQUIRY_NOT_TRANSITIONABLE). El camino
 *   canonico Consulta -> Alquiler es `convert-to-rental`, que ademas marca la
 *   consulta CONVERTIDA.
 */
@Injectable()
export class CreateRentalHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly creationGuard: RentalCreationGuard,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CreateRentalCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'CREATE', { companyId: context.companyId, branchId: context.branchId });

    if (!command.inquiryId) {
      throw new RentalInquiryRequiredError();
    }

    const customer = await this.rentals.findCustomerById(command.customerId);
    if (
      !customer ||
      customer.organizationId !== context.organizationId ||
      customer.operatingCompanyId !== context.companyId
    ) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        detail: 'El cliente indicado no existe en esta empresa.',
      });
    }

    this.creationGuard.assertCustomerNotBlocked(customer);

    const vehicle = await this.rentals.findVehicleById(command.vehicleId);
    if (!vehicle || vehicle.operatingCompanyId !== context.companyId) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: 'El vehículo indicado no existe en esta empresa.',
      });
    }

    if (command.startAt && command.expectedEndAt && command.startAt >= command.expectedEndAt) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RENTAL_PERIOD',
        detail: 'La fecha de inicio debe ser anterior a la fecha esperada de fin.',
      });
    }

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    return this.transactionManager.run(async (tx) => {
      const inquiry = await this.rentals.findInquiryForRental(command.inquiryId as string, context.organizationId, tx);
      if (
        !inquiry ||
        inquiry.organizationId !== context.organizationId ||
        inquiry.operatingCompanyId !== context.companyId ||
        inquiry.branchId !== context.branchId
      ) {
        throw new RentalInquiryNotFoundError();
      }
      if (inquiry.status !== 'COTIZADA') {
        throw new InquiryNotTransitionableError(inquiry.status);
      }
      if (inquiry.customerId !== command.customerId) {
        throw new RentalInquiryCustomerMismatchError();
      }
      const quotation = inquiry.quotations[0];
      if (!quotation) {
        throw new InquiryNotTransitionableError(inquiry.status);
      }
      if (quotation.validUntil.getTime() <= this.clock.now().getTime()) {
        throw new QuotationExpiredError(quotation.validUntil);
      }
      if (quotation.vehicleId !== command.vehicleId) {
        throw new RentalInquiryVehicleMismatchError();
      }
      const estimatedDays = quotation.estimatedDays;

      await this.creationGuard.assertVehicleAvailable(
        vehicle,
        context.branchId,
        this.creationGuard.resolveWindow({
          startAt: command.startAt,
          expectedEndAt: command.expectedEndAt,
          estimatedDays,
        }),
        tx,
      );

      const converted = await this.rentals.markInquiryConverted(inquiry.id, scope, tx);
      if (!converted) {
        throw new InquiryNotTransitionableError('CONVERTIDA');
      }

      const created = await this.rentals.create(
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
          customerId: command.customerId,
          vehicleId: command.vehicleId,
          planCode: command.planCode ?? 'NORMAL',
          startAt: command.startAt,
          expectedEndAt: command.expectedEndAt,
          inquiryId: inquiry.id,
          createdBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordInquiryEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          inquiryId: inquiry.id,
          action: 'INQUIRY_CONVERTED_TO_RENTAL',
          changes: { rentalId: created.id, quotationId: quotation.id, vehicleId: quotation.vehicleId, via: 'POST /rentals' },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'inquiry',
          aggregateId: inquiry.id,
          eventType: 'ConsultaConvertida.v1',
          payload: {
            inquiryId: inquiry.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            target: 'RENTAL',
            rentalId: created.id,
            convertedBy: command.firebaseUid,
          },
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: created.id,
          action: 'RENTAL_CREATED',
          changes: {
            status: created.status,
            customerId: created.customerId,
            vehicleId: created.vehicleId,
            planCode: created.planCode,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: created.id,
          eventType: 'RentalCreated.v1',
          payload: {
            rentalId: created.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            customerId: created.customerId,
            vehicleId: created.vehicleId,
            status: created.status,
            createdAt: created.createdAt.toISOString(),
          },
        },
        tx,
      );

      return created;
    });
  }
}
