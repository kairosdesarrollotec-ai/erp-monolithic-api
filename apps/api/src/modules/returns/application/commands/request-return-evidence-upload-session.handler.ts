import { Injectable } from '@nestjs/common';
import { ReturnEvidenceStoragePort } from '../ports/return-evidence-storage.port';
import { ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  InvalidReturnEvidenceError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import {
  MAX_RETURN_EVIDENCE_BYTES,
  MAX_RETURN_PHOTO_BYTES,
  RETURN_EVIDENCE_ALLOWED_STATUSES,
} from '../../domain/return-evidence-requirements';
import { RequestReturnEvidenceUploadSessionCommand } from './request-return-evidence-upload-session.command';

/** TR-08 / BR-DEV-009 - URL firmada de GCS para subir foto/video del checklist de retorno. */
@Injectable()
export class RequestReturnEvidenceUploadSessionHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly storage: ReturnEvidenceStoragePort,
  ) {}

  async execute(
    command: RequestReturnEvidenceUploadSessionCommand,
  ): Promise<{ uploadUrl: string; objectUrl: string; expiresAt: Date }> {
    const { scope } = await this.access.authorize(command, 'UPLOAD_EVIDENCE');

    const expectedPrefix = command.type === 'PHOTO' ? 'image/' : 'video/';
    if (!command.contentType.startsWith(expectedPrefix)) {
      throw new InvalidReturnEvidenceError(
        `El tipo ${command.type} no admite contentType ${command.contentType} (se esperaba ${expectedPrefix}*).`,
      );
    }
    const maxBytes = command.type === 'PHOTO' ? MAX_RETURN_PHOTO_BYTES : MAX_RETURN_EVIDENCE_BYTES;
    if (command.contentLength > maxBytes) {
      throw new InvalidReturnEvidenceError(
        `El archivo supera el tamaño máximo permitido de ${Math.round(maxBytes / (1024 * 1024))} MB (recibido: ${command.contentLength} bytes).`,
      );
    }

    const found = await this.returns.findById(command.returnId, scope);
    if (!found) {
      throw new ReturnNotFoundError(command.returnId);
    }
    if (!RETURN_EVIDENCE_ALLOWED_STATUSES.has(found.status)) {
      throw new ReturnStateConflictError('subir evidencia en', found.status);
    }

    return this.storage.generateSignedUploadUrl({
      companyId: command.companyId,
      returnId: command.returnId,
      type: command.type,
      zone: command.zone,
      contentType: command.contentType,
    });
  }
}
