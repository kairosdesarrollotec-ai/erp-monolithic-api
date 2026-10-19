import type { Prisma } from '@prisma/client';
import type { SyncChecklistType } from '../../domain/sync-types';

/**
 * Puerto que consumen los handlers de cierre (Devolucion `complete-inspection`, Alquiler `complete-delivery`):
 * el cierre queda bloqueado (409 SYNC_CONFLICT_PENDING) mientras el checklist tenga conflictos sin resolver.
 */
export abstract class SyncClosureGatePort {
  abstract assertSynced(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: { organizationId: string; operatingCompanyId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
