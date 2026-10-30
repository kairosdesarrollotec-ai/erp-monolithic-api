import { Injectable, Optional } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { ReturnCustomerRiskPort } from '../ports/return-customer-risk.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { assertCanTransitionReturn } from '../../domain/return-status';
import { ResolveAlcoholEscalationCommand } from './resolve-alcohol-escalation.command';

export const ALCOHOL_ESCALATION_KEY_PREFIX = 'return-alcohol-escalation:';
const ACTION = 'resolver la escalada de alcolímetro de';

function assertEscalationPending(current: ReturnRecord): void {
  if (current.status !== 'RECEPCION_PROVISIONAL') {
    throw new ReturnStateConflictError(ACTION, current.status);
  }
  if (current.alcoholTestResult !== 'DESFAVORABLE' && current.alcoholTestResult !== 'RECHAZADO') {
    throw new ReturnStateConflictError(
      ACTION,
      current.status,
      'No hay escalada pendiente: el alcolímetro de salida no fue DESFAVORABLE ni RECHAZADO (BR-DEV-005).',
    );
  }
}

/**
 * DEV-04 / BR-DEV-005 - Decisión de Gerencia ante un alcolímetro de salida desfavorable/rechazado.
 * PROVISIONAL (PROP-014): los documentos no definen las opciones.
 *  - CONTINUE_TO_INSPECTION -> INSPECCION (custodia VeloxRent).
 *  - KEEP_IN_CUSTODY -> permanece en RECEPCION_PROVISIONAL; puede volver a resolverse (cada decisión se audita).
 * markCustomerRed=true pone Customer.status en ROJO (solo hacia adelante, BR-DEV-008).
 */
@Injectable()
export class ResolveAlcoholEscalationHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly customerRisk: ReturnCustomerRiskPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    @Optional() private readonly dashboardAlerts?: ReturnDashboardAlertPort,
  ) {}

  async execute(command: ResolveAlcoholEscalationCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'RESOLVE_ALCOHOL_ESCALATION');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }
    assertEscalationPending(existing);

    const proceed = command.decision === 'CONTINUE_TO_INSPECTION';
    const now = this.clock.now();

    const result = await this.transactionManager.run(async (tx) => {
      const current = await this.returns.findById(command.id, scope, tx);
      if (!current) {
        throw new ReturnNotFoundError(command.id);
      }
      assertEscalationPending(current);
      if (proceed) {
        assertCanTransitionReturn(current.status, 'INSPECCION');
      }

      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          status: proceed ? 'INSPECCION' : undefined,
          custodyHolder: 'VELOXRENT',
          alcoholEscalationDecision: command.decision,
          alcoholEscalationMarkedRed: command.markCustomerRed,
          alcoholEscalationNotes: command.notes.trim(),
          alcoholEscalationDecidedById: command.firebaseUid,
          alcoholEscalationDecidedAt: now,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      const risk = command.markCustomerRed
        ? await this.customerRisk.escalate(
            { customerId: updated.customerId, organizationId: context.organizationId, operatingCompanyId: scope.operatingCompanyId, target: 'ROJO', reason: 'Alcoholemia desfavorable/rechazada en la devolución (resuelta por Gerencia).' },
            tx,
          )
        : null;

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_ALCOHOL_ESCALATION_RESOLVED',
          changes: {
            returnId: updated.id,
            decision: command.decision,
            markCustomerRed: command.markCustomerRed,
            notes: command.notes.trim(),
            alcoholTestResult: updated.alcoholTestResult,
            newStatus: updated.status,
            customerRiskStatus: risk ? risk.current : undefined,
            customerRiskPrevious: risk ? risk.previous : undefined,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'return',
          aggregateId: updated.id,
          eventType: 'DevolucionAlcoholResueltoPorGerencia.v1',
          payload: {
            returnId: updated.id,
            rentalId: updated.rentalId,
            customerId: updated.customerId,
            decision: command.decision,
            markCustomerRed: command.markCustomerRed,
            customerRiskStatus: risk ? risk.current : null,
            status: updated.status,
            decidedById: command.firebaseUid,
            decidedAt: now.toISOString(),
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return updated;
    });

    // V-23: con la decisión de continuar, la escalada deja de estar pendiente y su alerta sale del Tablero.
    // KEEP_IN_CUSTODY sigue pendiente (puede volver a resolverse), por eso conserva la alerta. No bloqueante.
    if (proceed && this.dashboardAlerts) {
      try {
        await this.dashboardAlerts.dismissByReturn(result.id, [ALCOHOL_ESCALATION_KEY_PREFIX], now);
      } catch {
        // la decisión ya quedó registrada; el Tablero se reconcilia al cerrar la devolución.
      }
    }
    return result;
  }
}
