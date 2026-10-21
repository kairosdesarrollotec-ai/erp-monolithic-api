import type { SyncChecklistType, SyncConflictStatus } from '../../domain/sync-types';

export class GetChecklistSyncStatusQuery {
  constructor(
    public readonly checklistType: SyncChecklistType,
    public readonly sourceId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}

export class ListSyncConflictsQuery {
  constructor(
    public readonly checklistType: SyncChecklistType,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly sourceId?: string,
    public readonly status?: SyncConflictStatus,
  ) {}
}
