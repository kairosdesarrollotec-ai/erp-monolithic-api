import { Injectable } from '@nestjs/common';
import type { LeaveEvidence } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import {
  InvalidLeaveEvidenceError,
  LeaveEvidenceNotAllowedError,
  LeaveNotFoundError,
} from '../../domain/hr-administration-errors';
import { LEAVE_EVIDENCE_CONTENT_TYPES, MAX_LEAVE_EVIDENCE_FILES } from '../../domain/hr-administration-rules';
import { RecordLeaveEvidenceCommand } from './record-leave-evidence.command';

const GCS_URL_PREFIX = 'https://storage.googleapis.com/';

/** ADP-04: confirma la evidencia ya subida con la URL firmada y la deja adjunta al permiso. */
@Injectable()
export class RecordLeaveEvidenceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: RecordLeaveEvidenceCommand): Promise<LeaveEvidence> {
    const leave = await this.leaves.findById(command.leaveId);
    if (!leave) {
      throw new LeaveNotFoundError(command.leaveId);
    }

    const { context } = await this.access.authorizeAny(
      {
        firebaseUid: command.firebaseUid,
        companyId: leave.employee.operatingCompanyId,
        branchId: leave.employee.branchId,
      },
      ['MANAGE_EMPLOYEES', 'AUTHORIZE_LEAVE', 'REQUEST_FIELD_TRIP'],
    );

    // La URL debe ser un objeto emitido para ESTE permiso y esta empresa (aislamiento multiempresa).
    const ownedPath = `/companies/${leave.employee.operatingCompanyId}/leaves/${leave.id}/`;
    if (!command.objectUrl.startsWith(GCS_URL_PREFIX) || !command.objectUrl.includes(ownedPath)) {
      throw new InvalidLeaveEvidenceError('objectUrl debe ser una URL de almacenamiento emitida para este permiso.');
    }
    if (!(LEAVE_EVIDENCE_CONTENT_TYPES as readonly string[]).includes(command.contentType)) {
      throw new InvalidLeaveEvidenceError(`Tipo de archivo no admitido (${command.contentType}).`);
    }

    return this.transactionManager.run(async (tx) => {
      const current = await this.leaves.findById(leave.id, tx);
      if (!current) {
        throw new LeaveNotFoundError(leave.id);
      }
      if (current.status !== 'SOLICITADO') {
        throw new LeaveEvidenceNotAllowedError(current.id, current.status);
      }
      if ((await this.leaves.countEvidence(current.id, tx)) >= MAX_LEAVE_EVIDENCE_FILES) {
        throw new InvalidLeaveEvidenceError(`Un permiso admite hasta ${MAX_LEAVE_EVIDENCE_FILES} archivos de evidencia.`);
      }

      const evidence = await this.leaves.addEvidence(
        {
          leaveId: current.id,
          objectUrl: command.objectUrl,
          contentType: command.contentType,
          uploadedById: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'leave',
          entityId: current.id,
          action: 'LEAVE_EVIDENCE_ATTACHED',
          changes: { employeeId: current.employeeId, evidenceId: evidence.id, contentType: evidence.contentType },
        },
        tx,
      );

      return evidence;
    });
  }
}
