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
import { AlternativeVehicleRequiredError, SALE_REFUND_CANCEL_REASON } from '../../domain/reservation-sale-resolution';
import { ResolveVehicleSaleCommand } from './resolve-vehicle-sale.command';

/**
 * UC-RES-004 / BR-RES-007 (RES-P15/P16, RES-07) - resolve-sale: el cliente
 * decide (decision sincrona, TDD 10.2) y Gerencia/Administrador la registra.
 * Solo desde PENDING_SALE_RESOLUTION. DEC-RES-SALE-001:
 *
 * - ACCEPT_ALTERNATIVE: la reserva se reformula sobre el vehiculo alternativo
 *   (el del comando, o el ofrecido en flag-sale) y vuelve a DRAFT para que
 *   RES-04 la complete: se CONSERVA el pago validado (el cliente ya pago el
 *   monto vigente, BR-RES-001) y se LIMPIA `documents_completed_at` porque el
 *   contrato/formato nuevo es sobre otro vehiculo ("reenvia requisitos, se
 *   emite nuevo formato", BDD 10.6). Se libera el commitment del vehiculo
 *   vendido y se valida la alternativa con la regla compartida de solape
 *   (409 VEHICLE_NOT_AVAILABLE); el commitment del alternativo lo crea
 *   `confirm` (bloqueo atomico, BR-RES-009), nunca antes. La ventana no
 *   cambia (BR-RES-003: no hay reprogramacion). Evento `ReservationReformulated`.
 * - REJECT: cancela con motivo VEHICLE_SOLD_REFUND (el monto NO se pierde,
 *   a diferencia de BR-RES-003/no-show), libera el commitment y deja el
 *   reembolso inmediato como PENDING_TRANSFER para que Gerencia lo transfiera
 *   (@SC-RES-006.01); sin integracion de pagos. Evento `ReservationCancelled`
 *   (el mismo que ya consume el tablero) con `reason`/`refund` en el payload.
 *
 * Todo en una transaccion Serializable con `updateMany` atomico por
 * scope+version+estado (412 RESERVATION_VERSION_CONFLICT) y auditoria.
 */
@Injectable()
export class ResolveVehicleSaleHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly saleResolutions: ReservationSaleResolutionRepositoryPort,
    private readonly alternativeGuard: SaleAlternativeVehicleGuard,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: ResolveVehicleSaleCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'RESOLVE_SALE', {
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
    if (existing.status !== 'PENDING_SALE_RESOLUTION') {
      throw new ReservationStateConflictError('resolver la venta de', existing.status);
    }

    return this.transactionManager.run(
      async (tx) => {
        const current = await this.reservations.findById(command.id, scope, tx);
        if (!current) throw new NotFoundException('Reserva no encontrada.');
        if (current.status !== 'PENDING_SALE_RESOLUTION') {
          throw new ReservationStateConflictError('resolver la venta de', current.status);
        }

        const base = { ...scope, id: command.id, expectedVersion: command.expectedVersion, resolvedBy: command.firebaseUid, note: command.note };

        if (command.decision === 'REJECT') {
          const cancelled = await this.saleResolutions.rejectSale(base, tx);

          await this.auditRepository.recordReservationEvent(
            {
              organizationId: context.organizationId,
              actorUserId: command.firebaseUid,
              reservationId: cancelled.id,
              action: 'RESERVATION_SALE_REJECTED_CANCELLED',
              changes: {
                reason: SALE_REFUND_CANCEL_REASON,
                note: command.note ?? null,
                refund: { status: 'PENDING_TRANSFER', amount: current.requiredPaymentAmount, currency: current.currency },
              },
            },
            tx,
          );
          await this.outboxRepository.publish(
            {
              aggregateType: 'Reservation',
              aggregateId: cancelled.id,
              eventType: 'ReservationCancelled',
              payload: {
                organizationId: context.organizationId,
                operatingCompanyId: command.companyId,
                branchId: command.branchId,
                reason: SALE_REFUND_CANCEL_REASON,
                note: command.note ?? null,
                cancelledBy: command.firebaseUid,
                refund: { status: 'PENDING_TRANSFER', amount: current.requiredPaymentAmount, currency: current.currency },
              },
            },
            tx,
          );
          return cancelled;
        }

        const resolution = await this.saleResolutions.findLatestByReservationId(command.id, tx);
        const alternativeVehicleId = command.alternativeVehicleId ?? resolution?.offeredVehicle?.id;
        if (!alternativeVehicleId) throw new AlternativeVehicleRequiredError();
        await this.alternativeGuard.assertUsable(current, alternativeVehicleId, tx);

        const reformulated = await this.saleResolutions.acceptAlternative({ ...base, alternativeVehicleId }, tx);

        await this.auditRepository.recordReservationEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            reservationId: reformulated.id,
            action: 'RESERVATION_SALE_ALTERNATIVE_ACCEPTED',
            changes: {
              soldVehicleId: current.vehicleId,
              alternativeVehicleId,
              paymentKept: current.paymentValidatedAt !== null,
              status: reformulated.status,
              note: command.note ?? null,
            },
          },
          tx,
        );
        await this.outboxRepository.publish(
          {
            aggregateType: 'Reservation',
            aggregateId: reformulated.id,
            eventType: 'ReservationReformulated',
            payload: {
              organizationId: context.organizationId,
              operatingCompanyId: command.companyId,
              branchId: command.branchId,
              vehicleId: alternativeVehicleId,
              soldVehicleId: current.vehicleId,
              startAt: reformulated.startAt,
              endAt: reformulated.endAt,
              resolvedBy: command.firebaseUid,
            },
          },
          tx,
        );
        return reformulated;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
