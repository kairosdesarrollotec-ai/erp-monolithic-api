import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { SyncScope } from '../../application/ports/sync-state-repository.port';
import { SyncSourcePort, SyncSourceRecord } from '../../application/ports/sync-source.port';
import type { SyncChecklistType } from '../../domain/sync-types';

/** ENTREGA-04 solo captura con el alquiler en PENDING_DELIVERY (RecordEvidenceHandler / CompleteDeliveryHandler). */
const DELIVERY_DRAFT_STATUSES: ReadonlySet<string> = new Set(['PENDING_DELIVERY']);
/** DEV-04: mismos estados que RETURN_EVIDENCE_ALLOWED_STATUSES (return-evidence-requirements.ts). */
const RECEPTION_DRAFT_STATUSES: ReadonlySet<string> = new Set(['RECEPCION_PROVISIONAL', 'INSPECCION', 'CON_DANOS']);

/** Lectura del expediente (solo lectura; no muta Rentals ni Returns). Filtra por organizacion/empresa/sede. */
@Injectable()
export class PrismaSyncSourceAdapter extends SyncSourcePort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async find(checklistType: SyncChecklistType, sourceId: string, scope: SyncScope): Promise<SyncSourceRecord | null> {
    const where = {
      id: sourceId,
      organizationId: scope.organizationId,
      operatingCompanyId: scope.operatingCompanyId,
      branchId: scope.branchId,
    };
    if (checklistType === 'ENTREGA') {
      const rental = await this.prisma.rental.findFirst({ where, select: { id: true, status: true } });
      return rental
        ? { sourceId: rental.id, rentalId: rental.id, status: rental.status, acceptsDrafts: DELIVERY_DRAFT_STATUSES.has(rental.status) }
        : null;
    }
    const rentalReturn = await this.prisma.rentalReturn.findFirst({ where, select: { id: true, rentalId: true, status: true } });
    return rentalReturn
      ? {
          sourceId: rentalReturn.id,
          rentalId: rentalReturn.rentalId,
          status: rentalReturn.status,
          acceptsDrafts: RECEPTION_DRAFT_STATUSES.has(rentalReturn.status),
        }
      : null;
  }
}
