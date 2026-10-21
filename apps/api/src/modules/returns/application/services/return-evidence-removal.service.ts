import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ReturnEvidenceRecord, ReturnRepositoryPort, ReturnScope } from '../ports/return-repository.port';
import { ReturnEvidenceNotFoundError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { RETURN_EVIDENCE_ALLOWED_STATUSES } from '../../domain/return-evidence-requirements';

/**
 * Unica logica de «se puede eliminar esta evidencia de recepcion y como»: solo en los estados donde aun se puede registrar
 * evidencia (RETURN_EVIDENCE_ALLOWED_STATUSES). La reutilizan el borrado directo (DEPRECADO, EVIDENCE.DELETE_DIRECT) y la
 * ejecucion de la solicitud con doble aprobacion (DEC-EVID-DELETE-002). No autoriza: quien llama ya valido el permiso.
 */
@Injectable()
export class ReturnEvidenceRemovalService {
  constructor(private readonly returns: ReturnRepositoryPort) {}

  async locate(returnId: string, evidenceId: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<ReturnEvidenceRecord> {
    await this.assertRemovableState(returnId, scope, tx);
    const found = (await this.returns.listEvidences(returnId, scope)).find((item) => item.id === evidenceId);
    if (!found) throw new ReturnEvidenceNotFoundError(evidenceId);
    return found;
  }

  async remove(returnId: string, evidenceId: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<void> {
    await this.assertRemovableState(returnId, scope, tx);
    const removed = await this.returns.deleteEvidence(returnId, evidenceId, scope, tx);
    if (!removed) throw new ReturnEvidenceNotFoundError(evidenceId);
  }

  private async assertRemovableState(returnId: string, scope: ReturnScope, tx?: Prisma.TransactionClient): Promise<void> {
    const found = await this.returns.findById(returnId, scope, tx);
    if (!found) throw new ReturnNotFoundError(returnId);
    if (!RETURN_EVIDENCE_ALLOWED_STATUSES.has(found.status)) {
      throw new ReturnStateConflictError('eliminar evidencia en', found.status);
    }
  }
}
