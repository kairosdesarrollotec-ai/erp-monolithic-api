import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RentalEvidenceRemovalService } from '../../../rentals/application/services/rental-evidence-removal.service';
import { ReturnEvidenceRemovalService } from '../../../returns/application/services/return-evidence-removal.service';
import { EvidenceDeletionTargetPort } from '../../application/ports/evidence-deletion-target.port';
import type { EvidenceDeletionScope } from '../../application/ports/evidence-deletion-request-repository.port';
import type { EvidenceDeletionTargetKind, EvidenceSnapshot } from '../../domain/evidence-deletion-types';

/** Adaptador hacia Alquiler / Devolucion: reutiliza SUS servicios de remocion (misma regla que el borrado directo), no duplica logica. */
@Injectable()
export class RemovalServicesEvidenceDeletionTarget extends EvidenceDeletionTargetPort {
  constructor(
    private readonly rentalRemoval: RentalEvidenceRemovalService,
    private readonly returnRemoval: ReturnEvidenceRemovalService,
  ) {
    super();
  }

  async locate(
    kind: EvidenceDeletionTargetKind,
    parentId: string,
    evidenceId: string,
    scope: EvidenceDeletionScope,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceSnapshot> {
    const found =
      kind === 'RENTAL'
        ? await this.rentalRemoval.locate(parentId, evidenceId, scope, tx)
        : await this.returnRemoval.locate(parentId, evidenceId, scope, tx);
    return {
      type: found.type,
      zone: found.zone,
      objectUrl: found.objectUrl,
      uploadedBy: found.uploadedBy,
      uploadedAt: found.uploadedAt.toISOString(),
    };
  }

  async remove(
    kind: EvidenceDeletionTargetKind,
    parentId: string,
    evidenceId: string,
    scope: EvidenceDeletionScope,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (kind === 'RENTAL') await this.rentalRemoval.remove(parentId, evidenceId, scope, tx);
    else await this.returnRemoval.remove(parentId, evidenceId, scope, tx);
  }
}
