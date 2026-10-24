import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { RecordMechanicReportCommand } from './record-mechanic-report.command';

/**
 * DEC-DEV-REPORT-001 (23-oct-2026, Frente C):
 * Registra la aceptación del informe mecánico/Motrix por el cliente para daños.
 */
@Injectable()
export class RecordMechanicReportHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordMechanicReportCommand): Promise<ReturnRecord> {
    const { context, scope } = await this.access.authorize(command, 'CLOSE');

    const existing = await this.returns.findById(command.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(command.id);
    }

    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const updated = await this.returns.update(
        {
          id: command.id,
          scope,
          expectedVersion: command.expectedVersion,
          mechanicReportAccepted: command.accepted,
          mechanicReportAcceptedAt: now,
          mechanicReportAcceptedBy: command.firebaseUid,
          mechanicReportNotes: command.notes?.trim() || null,
          updatedBy: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordRentalEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          rentalId: updated.rentalId,
          action: 'RETURN_MECHANIC_REPORT_RECORDED',
          changes: {
            returnId: updated.id,
            accepted: command.accepted,
            notes: command.notes,
            recordedAt: now,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
