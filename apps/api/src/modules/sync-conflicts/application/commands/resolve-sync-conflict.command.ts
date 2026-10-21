import type { SyncResolution } from '../../domain/sync-types';

export class ResolveSyncConflictCommand {
  constructor(
    public readonly conflictId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly resolution: SyncResolution,
    public readonly reason: string | null | undefined,
    public readonly confirmed: boolean | null | undefined,
  ) {}
}
