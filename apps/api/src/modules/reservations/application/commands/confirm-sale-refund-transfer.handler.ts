import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationSaleResolutionRepositoryPort } from '../ports/reservation-sale-resolution-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationSaleRefundConflictError } from '../../domain/reservation-errors';
import { ConfirmSaleRefundTransferCommand } from './confirm-sale-refund-transfer.command';

/**
 * C4: Confirmación de transferencia de reembolso por venta del vehículo (BR-RES-007, SC-RES-006).
 * Roles: GERENCIA y FINANZAS (RESERVATION.CONFIRM_SALE_REFUND).
 * Solo para reservas canceladas por venta con cliente que rechazó alternativa (PENDING_TRANSFER).
 * Actualiza a TRANSFERRED y registra voucher, fecha y usuario.
 */
@Injectable()
export class ConfirmSaleRefundTransferHandler {
  constructor(
    private readonly reservations: ReservationRepositoryPort,
    private readonly saleResolutions: ReservationSaleResolutionRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: ConfirmSaleRefundTransferCommand): Promise<ReservationRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'RESERVATION', 'CONFIRM_SALE_REFUND', {
      companyId: context.companyId,
      branchId: context.branchId,
    });

    return this.transactionManager.run(async (tx) => {
      const current = await this.reservations.findById(
        command.id,
        {
          organizationId: context.organizationId,
          operatingCompanyId: context.companyId,
          branchId: context.branchId,
        },
        tx,
      );

      if (!current) {
        throw new NotFoundException(`Reserva ${command.id} no encontrada en este contexto.`);
      }

      if (current.status !== 'CANCELLED') {
        throw new ReservationSaleRefundConflictError(
          'Solo se puede confirmar el reembolso de una reserva cancelada por venta de vehículo.',
        );
      }

      const updated = await this.saleResolutions.confirmRefundTransfer(
        {
          id: command.id,
          expectedVersion: command.expectedVersion,
          transferVoucher: command.transferVoucher,
          transferredAt: command.transferredAt,
          transferredBy: command.firebaseUid,
          scope: {
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      await this.auditRepository.recordReservationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          reservationId: command.id,
          action: 'SALE_REFUND_TRANSFERRED',
          changes: {
            transferVoucher: command.transferVoucher,
            transferredAt: command.transferredAt.toISOString(),
            transferredBy: command.firebaseUid,
            note: command.note ?? null,
            refundStatus: 'TRANSFERRED',
          },
        },
        tx,
      );

      await this.outboxRepository.publish(
        {
          aggregateType: 'reservation',
          aggregateId: command.id,
          eventType: 'ReservationSaleRefundTransferred.v1',
          payload: {
            reservationId: command.id,
            transferVoucher: command.transferVoucher,
            transferredAt: command.transferredAt.toISOString(),
            transferredBy: command.firebaseUid,
            refundStatus: 'TRANSFERRED',
          },
        },
        tx,
      );

      return updated;
    });
  }
}
