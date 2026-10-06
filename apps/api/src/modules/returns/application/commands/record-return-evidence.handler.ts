import { Injectable } from '@nestjs/common';
import { ReturnEvidenceRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  InvalidReturnEvidenceError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { RETURN_EVIDENCE_ALLOWED_STATUSES } from '../../domain/return-evidence-requirements';
import { RecordReturnEvidenceCommand } from './record-return-evidence.command';

const GCS_URL_PREFIX = 'https://storage.googleapis.com/';

/** TR-08 / BR-DEV-009 - Confirma la evidencia ya subida a GCS con la URL firmada de upload-url. */
@Injectable()
export class RecordReturnEvidenceHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
  ) {}

  async execute(command: RecordReturnEvidenceCommand): Promise<ReturnEvidenceRecord> {
    const { context, scope } = await this.access.authorize(command, 'UPLOAD_EVIDENCE');

    // La URL debe ser un objeto de GCS emitido para ESTA devolución y empresa (aislamiento multiempresa).
    const ownedPath = `/companies/${command.companyId}/returns/${command.returnId}/`;
    if (!command.objectUrl.startsWith(GCS_URL_PREFIX) || !command.objectUrl.includes(ownedPath)) {
      throw new InvalidReturnEvidenceError(
        'objectUrl debe ser una URL de GCS válida emitida por upload-url para esta devolución.',
      );
    }

    const found = await this.returns.findById(command.returnId, scope);
    if (!found) {
      throw new ReturnNotFoundError(command.returnId);
    }
    if (!RETURN_EVIDENCE_ALLOWED_STATUSES.has(found.status)) {
      throw new ReturnStateConflictError('registrar evidencia en', found.status);
    }

    return this.returns.addEvidence({
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
      returnId: command.returnId,
      type: command.type,
      zone: command.zone,
      objectUrl: command.objectUrl,
      uploadedBy: command.firebaseUid,
    });
  }
}
