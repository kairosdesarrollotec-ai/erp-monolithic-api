import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { InquiryNotTransitionableError } from '../../../inquiries/domain/inquiry-errors';
import { RentalCreationGuard } from '../services/rental-creation.guard';
import { RentalInquiryNotFoundError } from '../../domain/rental-errors';
import { CreateRentalCommand } from './create-rental.command';

/**
 * ALQ-01 / ALQ-02 - Crear Alquiler directo.
 * TDD-03-alquiler.md seccion 8.2 / SDD seccion 10.
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
  ) {}

  async execute(command: CreateRentalCommand): Promise<RentalRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'CREATE', { companyId: context.companyId, branchId: context.branchId });

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

    return this.transactionManager.run(async (tx) => {
      let estimatedDays: number | undefined;
      if (command.inquiryId) {
        const inquiry = await this.rentals.findInquiryForRental(command.inquiryId, context.organizationId, tx);
        if (
          !inquiry ||
          inquiry.organizationId !== context.organizationId ||
          inquiry.operatingCompanyId !== context.companyId
        ) {
          throw new RentalInquiryNotFoundError();
        }
        if (inquiry.status !== 'COTIZADA') {
          throw new InquiryNotTransitionableError(inquiry.status);
        }
        estimatedDays = inquiry.quotations[0]?.estimatedDays;
      }

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
          inquiryId: command.inquiryId,
          createdBy: command.firebaseUid,
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
