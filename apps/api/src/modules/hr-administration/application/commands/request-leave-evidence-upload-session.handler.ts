import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { LeaveEvidenceStoragePort } from '../ports/leave-evidence-storage.port';
import {
  InvalidLeaveEvidenceError,
  LeaveEvidenceNotAllowedError,
  LeaveNotFoundError,
} from '../../domain/hr-administration-errors';
import {
  LEAVE_EVIDENCE_CONTENT_TYPES,
  LeaveEvidenceContentType,
  MAX_LEAVE_EVIDENCE_BYTES,
  MAX_LEAVE_EVIDENCE_FILES,
} from '../../domain/hr-administration-rules';
import { RequestLeaveEvidenceUploadSessionCommand } from './request-leave-evidence-upload-session.command';

/** ADP-04: URL firmada para subir el sustento (certificado, foto, PDF) de un permiso aún pendiente de resolución. */
@Injectable()
export class RequestLeaveEvidenceUploadSessionHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
    private readonly storage: LeaveEvidenceStoragePort,
  ) {}

  async execute(
    command: RequestLeaveEvidenceUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    const leave = await this.leaves.findById(command.leaveId);
    if (!leave) {
      throw new LeaveNotFoundError(command.leaveId);
    }

    await this.access.authorizeAny(
      {
        firebaseUid: command.firebaseUid,
        companyId: leave.employee.operatingCompanyId,
        branchId: leave.employee.branchId,
      },
      ['MANAGE_EMPLOYEES', 'AUTHORIZE_LEAVE', 'REQUEST_FIELD_TRIP'],
    );

    if (!(LEAVE_EVIDENCE_CONTENT_TYPES as readonly string[]).includes(command.contentType)) {
      throw new InvalidLeaveEvidenceError(
        `Tipo de archivo no admitido (${command.contentType}). Adjunta una imagen (JPG, PNG, WEBP) o un PDF.`,
      );
    }
    if (command.contentLength > MAX_LEAVE_EVIDENCE_BYTES) {
      throw new InvalidLeaveEvidenceError(
        `El archivo supera el tamaño máximo de ${Math.round(MAX_LEAVE_EVIDENCE_BYTES / (1024 * 1024))} MB.`,
      );
    }
    if (leave.status !== 'SOLICITADO') {
      throw new LeaveEvidenceNotAllowedError(leave.id, leave.status);
    }
    if ((await this.leaves.countEvidence(leave.id)) >= MAX_LEAVE_EVIDENCE_FILES) {
      throw new InvalidLeaveEvidenceError(`Un permiso admite hasta ${MAX_LEAVE_EVIDENCE_FILES} archivos de evidencia.`);
    }

    return this.storage.generateSignedUploadUrl({
      companyId: leave.employee.operatingCompanyId,
      leaveId: leave.id,
      contentType: command.contentType as LeaveEvidenceContentType,
    });
  }
}
