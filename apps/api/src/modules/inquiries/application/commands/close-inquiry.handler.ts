import { Injectable, NotFoundException } from '@nestjs/common';
import { InquiryRepositoryPort, InquiryRecord } from '../ports/inquiry-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { InquiryNotTransitionableError } from '../../domain/inquiry-errors';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { CloseInquiryCommand } from './close-inquiry.command';

/**
 * CON-P09 (BR-CON-002, DAT-CON-005) - cierra la consulta sin conversion,
 * con motivo obligatorio (`inquiry_close_reason` CHECK del TDD seccion 9,
 * reforzado aqui a nivel de aplicacion Y en la migracion). Genera
 * `audit_events` (TDD-CON-001.md seccion 17 - a diferencia de
 * register/quote, que son de bajo riesgo).
 *
 * Hallazgo critico de revision PR#7 ("auditoria no atomica"): la mutacion
 * y el registro de auditoria corren ahora dentro de una unica transaccion
 * abierta por `TransactionManagerPort.run` (mismo patron que
 * `CancelReservationHandler` desde PR#6) - un fallo al auditar revierte
 * tambien el cierre.
 *
 * Hallazgo ALTO de revalidacion PR#7 ("RBAC pendiente"): politica
 * rol-accion `CLOSE` (deny-by-default) tras resolver el contexto.
 */
@Injectable()
export class CloseInquiryHandler {
  constructor(
    private readonly inquiries: InquiryRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly outboxRepository: OutboxEventRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CloseInquiryCommand): Promise<InquiryRecord> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });
    await this.matrixAuth.assertAllowed(context.organizationId, context.roleId, 'INQUIRY', 'CLOSE', { companyId: context.companyId, branchId: context.branchId });

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: context.branchId,
    };

    const existing = await this.inquiries.findById(command.id, scope);
    if (!existing) {
      throw new NotFoundException('Consulta no encontrada.');
    }
    if (existing.status === 'CONVERTIDA' || existing.status === 'CERRADA_SIN_CONVERSION') {
      throw new InquiryNotTransitionableError(existing.status);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.inquiries.findById(command.id, scope, tx);
      if (!current) {
        throw new NotFoundException('Consulta no encontrada.');
      }
      if (current.status === 'CONVERTIDA' || current.status === 'CERRADA_SIN_CONVERSION') {
        throw new InquiryNotTransitionableError(current.status);
      }

      const closed = await this.inquiries.close(
        {
          id: command.id,
          ...scope,
          expectedVersion: command.expectedVersion,
          reason: command.reason,
          note: command.note,
          // P-06: historial append-only.
          interaction: {
            channel: current.channel,
            outcome: 'CERRADA_SIN_CONVERSION',
            note: command.note ? `${command.reason}: ${command.note}` : command.reason,
          },
        },
        ['REGISTRADA', 'COTIZADA'],
        tx,
      );

      await this.auditRepository.recordInquiryEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          inquiryId: closed.id,
          action: 'INQUIRY_CLOSED_WITHOUT_CONVERSION',
          changes: { reason: command.reason, note: command.note ?? null },
        },
        tx,
      );

      // P-07: ConsultaCerrada.v1 en la misma transaccion.
      await this.outboxRepository.publish(
        {
          aggregateType: 'inquiry',
          aggregateId: closed.id,
          eventType: 'ConsultaCerrada.v1',
          payload: {
            inquiryId: closed.id,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
            customerId: closed.customerId,
            reason: command.reason,
            closedBy: command.firebaseUid,
            closedAt: this.clock.now().toISOString(),
          },
        },
        tx,
      );

      return closed;
    });
  }
}
