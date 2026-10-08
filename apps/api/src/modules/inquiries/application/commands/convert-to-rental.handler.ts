import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord, QuotationRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { InquiryNotTransitionableError, QuotationExpiredError } from '../../domain/inquiry-errors';
import { ProvisionalQuotingGuard } from '../services/provisional-quoting.guard';
import { RentalRepositoryPort, RentalRecord } from '../../../rentals/application/ports/rental-repository.port';
import { RentalCreationGuard } from '../../../rentals/application/services/rental-creation.guard';
import { ConvertToRentalCommand } from './convert-to-rental.command';

export interface ConvertToRentalResult {
  inquiry: InquiryRecord;
  rental: RentalRecord;
}

/**
 * CON-P09 (BR-CON-002) - UC-CON-003. CASO DE USO UNICO para crear un Alquiler
 * directo desde una Consulta: en UNA transaccion (Serializable) transiciona
 * la Consulta COTIZADA -> CONVERTIDA, crea el Rental en DRAFT vinculado por
 * `inquiryId` y audita - todo o nada. Gemelo de ConvertToReservationHandler.
 *
 * - Vehiculo y duracion salen de la cotizacion VIGENTE mas reciente (nunca del
 *   payload); si vencio -> 409 QUOTATION_EXPIRED.
 * - El Rental se crea SIN `startAt`/`expectedEndAt`: la salida es inmediata y
 *   las fechas se fijan en `complete-delivery` (startAt = ahora,
 *   expectedEndAt = startAt + estimatedDays de la cotizacion).
 * - Endurecimiento de alquiler (ALQ-02): cliente ROJO -> CUSTOMER_BLOCKED;
 *   vehiculo AVAILABLE, de la sede y sin solape con reservas/compromisos en
 *   [ahora, ahora + estimatedDays) -> VEHICLE_NOT_AVAILABLE.
 * - La garantia (DAT-ALQ-005) NO se calcula aqui: se captura al formalizar el
 *   contrato. El monto de reserva no aplica (no hay reserva).
 * - RBAC: `CONVERT_TO_RENTAL` de Consulta Y `CREATE` de Alquiler.
 */
@Injectable()
export class ConvertToRentalHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly quotingGuard: ProvisionalQuotingGuard,
    private readonly clock: ClockPort,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly creationGuard: RentalCreationGuard,
  ) {}

  async execute(command: ConvertToRentalCommand): Promise<ConvertToRentalResult> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'CONVERT_TO_RENTAL', { companyId: context.companyId, branchId: context.branchId });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'CREATE', { companyId: context.companyId, branchId: context.branchId });
    this.quotingGuard.assertReady();

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    const existing = await this.inquiries.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    this.assertConvertible(existing);

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.inquiries.findById(command.id, scope, tx);
        if (!current) {
          throw new NotFoundException('Consulta no encontrada.');
        }
        this.assertConvertible(current);

        const now = this.clock.now();
        const quotation = this.currentValidQuotation(current, now);

        const customer = await this.rentals.findCustomerById(current.customerId!, tx);
        if (
          !customer ||
          customer.organizationId !== scope.organizationId ||
          customer.operatingCompanyId !== scope.operatingCompanyId
        ) {
          throw new NotFoundException({
            code: 'CUSTOMER_NOT_FOUND',
            detail: 'El cliente de la consulta no existe en esta empresa.',
          });
        }
        this.creationGuard.assertCustomerNotBlocked(customer);

        const vehicle = await this.rentals.findVehicleById(quotation.vehicleId, tx);
        if (!vehicle || vehicle.operatingCompanyId !== scope.operatingCompanyId) {
          throw new NotFoundException({
            code: 'VEHICLE_NOT_FOUND',
            detail: 'El vehículo de la cotización no existe en esta empresa.',
          });
        }
        await this.creationGuard.assertVehicleAvailable(
          vehicle,
          scope.branchId,
          this.creationGuard.resolveWindow({ startAt: now, estimatedDays: quotation.estimatedDays }),
          tx,
        );

        const converted = await this.inquiries.convertToRental(
          { id: command.id, ...scope, expectedVersion: command.expectedVersion },
          ['COTIZADA'],
          tx,
        );

        const rental = await this.rentals.create(
          {
            organizationId: scope.organizationId,
            operatingCompanyId: scope.operatingCompanyId,
            branchId: scope.branchId,
            customerId: current.customerId!,
            vehicleId: quotation.vehicleId,
            planCode: command.planCode ?? 'NORMAL',
            inquiryId: command.id,
            createdBy: command.firebaseUid,
          },
          tx,
        );

        await this.auditRepository.recordInquiryEvent(
          {
            organizationId: scope.organizationId,
            actorUserId: command.firebaseUid,
            inquiryId: converted.id,
            action: 'INQUIRY_CONVERTED_TO_RENTAL',
            changes: {
              rentalId: rental.id,
              quotationId: quotation.id,
              vehicleId: quotation.vehicleId,
              estimatedDays: quotation.estimatedDays,
            },
          },
          tx,
        );

        await this.auditRepository.recordRentalEvent(
          {
            organizationId: scope.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: rental.id,
            action: 'RENTAL_CREATED_FROM_INQUIRY',
            changes: {
              inquiryId: command.id,
              quotationId: quotation.id,
              status: rental.status,
              customerId: rental.customerId,
              vehicleId: rental.vehicleId,
              planCode: rental.planCode,
            },
          },
          tx,
        );

        await this.outboxRepository.publish(
          {
            aggregateType: 'rental',
            aggregateId: rental.id,
            eventType: 'RentalCreatedFromInquiry.v1',
            payload: {
              rentalId: rental.id,
              inquiryId: command.id,
              organizationId: scope.organizationId,
              operatingCompanyId: scope.operatingCompanyId,
              branchId: scope.branchId,
              customerId: rental.customerId,
              vehicleId: rental.vehicleId,
              status: rental.status,
              createdAt: rental.createdAt.toISOString(),
            },
          },
          tx,
        );

        return { inquiry: converted, rental };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private assertConvertible(inquiry: InquiryRecord): void {
    if (inquiry.status !== 'COTIZADA') {
      throw new InquiryNotTransitionableError(inquiry.status);
    }
    if (!inquiry.customerId) {
      throw new BadRequestException({
        code: 'CUSTOMER_REQUIRED_FOR_CONVERSION',
        detail: 'La consulta no tiene un cliente asociado - no se puede convertir a alquiler sin uno.',
      });
    }
  }

  /** Misma regla que ConvertToReservationHandler: la cotizacion vigente es la mas reciente y no vencida. */
  private currentValidQuotation(inquiry: InquiryRecord, now: Date): QuotationRecord {
    const [latest] = [...inquiry.quotations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (!latest) {
      throw new InquiryNotTransitionableError(inquiry.status);
    }
    if (latest.validUntil.getTime() <= now.getTime()) {
      throw new QuotationExpiredError(latest.validUntil);
    }
    return latest;
  }
}
