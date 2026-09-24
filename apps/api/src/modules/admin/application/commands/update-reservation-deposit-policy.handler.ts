import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { ReservationDepositPolicyPort } from '../../../parameters/application/ports/reservation-deposit-policy.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { UpdateReservationDepositPolicyCommand } from './update-reservation-deposit-policy.command';
import { ReservationDepositPolicyResult } from '../queries/get-reservation-deposit-policy.handler';

/**
 * ADM-03 - "Guardar cambios" del monto de reserva (contrato punto 7).
 * Regla BDD/SDD del contrato ("Solo una version contractual vigente a
 * la vez" - punto 8): esta accion nunca EDITA una fila, siempre INSERTA
 * una version nueva (ReservationDepositPolicyPort.createVersion) - la
 * version anterior queda en el historial, nunca se pierde (punto 11).
 *
 * Mismo criterio de atomicidad que el resto de ADM-01: la nueva version
 * y su auditoria corren en la misma transaccion.
 */
@Injectable()
export class UpdateReservationDepositPolicyHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly adminAuthorization: AdminMatrixAuthorizationService,
    private readonly depositPolicy: ReservationDepositPolicyPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  async execute(command: UpdateReservationDepositPolicyCommand): Promise<ReservationDepositPolicyResult> {
    const context = await this.workContext.authorize({
      firebaseUid: command.actorFirebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.adminAuthorization.assertAllowed(context.organizationId, context.role, 'MANAGE_PARAMETERS');

    const amount = Number(command.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        detail: 'El monto de reserva debe ser un numero positivo.',
      });
    }

    const previous = await this.depositPolicy.getCurrent(context.organizationId);

    const created = await this.transactionManager.run(async (tx) => {
      const version = await this.depositPolicy.createVersion(
        {
          organizationId: context.organizationId,
          amount: command.amount,
          currency: command.currency,
          createdBy: command.actorFirebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordAdminEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.actorFirebaseUid,
          targetFirebaseUid: command.actorFirebaseUid,
          action: 'RESERVATION_DEPOSIT_POLICY_UPDATED',
          changes: {
            previousAmount: previous.amount,
            previousCurrency: previous.currency,
            previousVersion: previous.version,
            newAmount: command.amount,
            newCurrency: command.currency,
            newVersion: version.version,
          },
        },
        tx,
      );

      return version;
    });

    return {
      version: created.version,
      amount: created.amount,
      currency: created.currency,
      effectiveFrom: created.effectiveFrom ? created.effectiveFrom.toISOString() : null,
    };
  }
}
