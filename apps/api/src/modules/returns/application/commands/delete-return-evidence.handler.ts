import { Injectable } from '@nestjs/common';
import { ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import {
  ReturnEvidenceNotFoundError,
  ReturnNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import { RETURN_EVIDENCE_ALLOWED_STATUSES } from '../../domain/return-evidence-requirements';
import { DeleteReturnEvidenceCommand } from './delete-return-evidence.command';

/**
 * DEV-04 - elimina una evidencia registrada por error durante el checklist
 * de recepcion. Solo en los estados donde aun se puede registrar evidencia
 * (RETURN_EVIDENCE_ALLOWED_STATUSES) y con la misma accion de matriz que
 * subirla (UPLOAD_EVIDENCE). Se borra el registro; el archivo del bucket no
 * se toca.
 */
@Injectable()
export class DeleteReturnEvidenceHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
  ) {}

  async execute(command: DeleteReturnEvidenceCommand): Promise<void> {
    const { scope } = await this.access.authorize(command, 'UPLOAD_EVIDENCE');

    const found = await this.returns.findById(command.returnId, scope);
    if (!found) {
      throw new ReturnNotFoundError(command.returnId);
    }
    if (!RETURN_EVIDENCE_ALLOWED_STATUSES.has(found.status)) {
      throw new ReturnStateConflictError('eliminar evidencia en', found.status);
    }

    const removed = await this.returns.deleteEvidence(command.returnId, command.evidenceId, scope);
    if (!removed) {
      throw new ReturnEvidenceNotFoundError(command.evidenceId);
    }
  }
}
