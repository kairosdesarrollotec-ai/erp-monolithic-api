import type { IncomingField } from '../../domain/sync-conflict-matrix';
import type { IncomingEvidence } from '../../domain/sync-evidence-merge';
import type { SyncChecklistType } from '../../domain/sync-types';

export class SyncChecklistCommand {
  constructor(
    public readonly checklistType: SyncChecklistType,
    public readonly sourceId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly deviceId: string | null,
    /** Cuando se creo el borrador en el dispositivo: base del TTL de 72 h. */
    public readonly draftCreatedAt: Date,
    public readonly fields: IncomingField[],
    public readonly evidence: IncomingEvidence[],
  ) {}
}
