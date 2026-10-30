import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { InvalidRentalStateTransitionError } from '../../domain/rental-errors';
import { canTransitionRental } from '../../domain/rental-status';
import { assertRentalCancelReason } from '../../domain/rental-cancel-reason';
import { CancelRentalCommand } from './cancel-rental.command';

/**
 * DEC-ALQ-CANCEL-001 (Russbel 22-oct-2026) - cancelar un alquiler antes de la entrega: documentos invalidos, el cliente
 * rechaza la notaria u otro motivo (nota obligatoria). Estados cancelables: DRAFT, VALIDATION, NOTARY_EVALUATION,
 * CONTRACTING y PENDING_DELIVERY (ALLOWED_RENTAL_TRANSITIONS); un alquiler ACTIVE/cerrado/cancelado -> 409
 * INVALID_RENTAL_STATE_TRANSITION. Libera el compromiso del vehiculo (si el alquiler heredo el de una reserva), audita y
 * publica `AlquilerCancelado.v1`. Si ya se cobro la garantia (PENDING_DELIVERY) se informa `depositPendingRefund` para que
 * Finanzas la devuelva (el flujo de reembolso por cancelacion queda pendiente).
 */
@Injectable()
export class CancelRentalHandler {
  constructor(
    private readonly rentals: RentalRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CancelRentalCommand): Promise<RentalRecord> {
    assertRentalCancelReason(command.reason, command.note);

    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RENTAL', 'CANCEL', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      branchId: command.branchId,
    };

    const existing = await this.rentals.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Alquiler no encontrado.');
    }
    if (!canTransitionRental(existing.status, 'CANCELLED')) {
      throw new InvalidRentalStateTransitionError(existing.status, 'CANCELLED');
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.rentals.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Alquiler no encontrado.');
      }
      if (!canTransitionRental(current.status, 'CANCELLED')) {
        throw new InvalidRentalStateTransitionError(current.status, 'CANCELLED');
      }

      const note = command.note?.trim() || undefined;
      const cancelled = await this.rentals.cancel(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          reason: command.reason,
          note,
          cancelledBy: command.firebaseUid,
          cancelledAt: this.clock.now(),
        },
        tx,
      );

      // CR-03: cancelar el alquiler cancela todo el proceso, tambien la reserva de origen.
      const originReservationCancelled = current.reservationId
        ? await this.rentals.cancelOriginReservation(current.reservationId, scope, tx)
        : false;

      const depositPendingRefund = !!current.deposit && current.deposit.status === 'HELD';

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: cancelled.id,
          action: 'RENTAL_CANCELLED',
          changes: {
            fromStatus: current.status,
            toStatus: 'CANCELLED',
            reason: command.reason,
            note: note ?? null,
            vehicleId: current.vehicleId,
            reservationId: current.reservationId,
            originReservationCancelled,
            depositPendingRefund,
            depositAmount: current.deposit?.originalAmount ?? null,
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'rental',
          aggregateId: cancelled.id,
          eventType: 'AlquilerCancelado.v1',
          payload: {
            rentalId: cancelled.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            customerId: cancelled.customerId,
            vehicleId: cancelled.vehicleId,
            fromStatus: current.status,
            reason: command.reason,
            depositPendingRefund,
            cancelledBy: command.firebaseUid,
          },
        },
        tx,
      );

      return cancelled;
    });
  }
}
