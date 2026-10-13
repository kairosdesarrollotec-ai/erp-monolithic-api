import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { SaleAlternativeVehicleGuard } from '../services/sale-alternative-vehicle.guard';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError } from '../../domain/reservation-errors';
import { ChangeReservationVehicleCommand } from './change-reservation-vehicle.command';

/**
 * RES-06 (Conflicto y alternativas, "Continuar -> RES-04 con alternativa
 * elegida") - cambia el vehiculo de una reserva en DRAFT. BR-RES-003 prohibe
 * reprogramar fechas/vehiculo de una reserva CONFIRMADA; en borrador aun no hay
 * compromiso ni confirmacion (no hay commitment), asi que no es una
 * reprogramacion. DEC-RES-CHANGE-VEHICLE-001:
 *
 * - Solo desde DRAFT (409 RESERVATION_STATE_CONFLICT en otro caso).
 * - El vehiculo nuevo se valida con el mismo guard que la alternativa de venta
 *   (empresa, distinto, sede, AVAILABLE, libre segun la regla compartida de
 *   solape): 422 ALTERNATIVE_VEHICLE_INVALID / 409 VEHICLE_NOT_AVAILABLE.
 * - Se conserva `payment_validated_at`; se limpia `documents_completed_at`
 *   (contrato/documentos refieren al vehiculo). Pendiente de Fiorella.
 *
 * Transaccion Serializable, `updateMany` atomico por scope+version+estado
 * (412 RESERVATION_VERSION_CONFLICT), auditoria y outbox en la misma tx.
 */
@Injectable()
export class ChangeReservationVehicleHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly saleResolutions: ReservationSaleResolutionRepositoryPort,
    private readonly vehicleGuard: SaleAlternativeVehicleGuard,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: ChangeReservationVehicleCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CHANGE_VEHICLE', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.reservations.findById(command.id, scope);
    if (!existing) throw new NotFoundException('Reserva no encontrada.');
    if (existing.status !== 'DRAFT') {
      throw new ReservationStateConflictError('cambiar el vehiculo de', existing.status);
    }

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.reservations.findById(command.id, scope, tx);
        if (!current) throw new NotFoundException('Reserva no encontrada.');
        if (current.status !== 'DRAFT') {
          throw new ReservationStateConflictError('cambiar el vehiculo de', current.status);
        }

        await this.vehicleGuard.assertUsable(current, command.vehicleId, tx);

        const changed = await this.saleResolutions.changeVehicle(
          { ...scope, id: command.id, expectedVersion: command.expectedVersion, vehicleId: command.vehicleId },
          tx,
        );

        await this.auditRepository.recordReservationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            reservationId: changed.id,
            action: 'RESERVATION_VEHICLE_CHANGED',
            changes: {
              previousVehicleId: current.vehicleId,
              vehicleId: command.vehicleId,
              paymentKept: current.paymentValidatedAt !== null,
              documentsCleared: current.documentsCompletedAt !== null,
            },
          },
          tx,
        );
        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: changed.id,
            eventType: 'ReservationVehicleChanged',
            payload: {
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              previousVehicleId: current.vehicleId,
              vehicleId: command.vehicleId,
              startAt: changed.startAt,
              endAt: changed.endAt,
              changedBy: command.firebaseUid,
            },
          },
          tx,
        );
        return changed;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
