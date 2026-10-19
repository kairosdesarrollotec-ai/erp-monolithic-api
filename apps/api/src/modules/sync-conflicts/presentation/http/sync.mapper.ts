import type { SyncConflictRecord } from '../../application/ports/sync-state-repository.port';
import type { ResolveSyncConflictResult } from '../../application/commands/resolve-sync-conflict.handler';
import type { SyncChecklistResult } from '../../application/commands/sync-checklist.handler';
import type { ChecklistSyncStatusResult } from '../../application/queries/get-checklist-sync-status.handler';
import { syncAuditRef } from '../../application/sync-audit-ref';
import { canMerge } from '../../domain/sync-conflict-resolution';
import type {
  ResolveSyncConflictResponse,
  SyncChecklistResponse,
  SyncChecklistResultResponse,
  SyncConflictResponse,
} from './dto/sync.response';

export function toSyncConflictResponse(c: SyncConflictRecord): SyncConflictResponse {
  return {
    id: c.id,
    auditRef: syncAuditRef(c.id),
    checklistType: c.checklistType,
    sourceId: c.sourceId,
    rentalId: c.rentalId,
    kind: c.kind,
    key: c.key,
    status: c.status,
    canMerge: c.status === 'OPEN' && canMerge(c.kind),
    serverVersion: c.serverVersion,
    localVersion: c.localVersion,
    resolution: c.resolution,
    reason: c.reason,
    detectedBy: c.detectedBy,
    deviceId: c.deviceId,
    resolvedBy: c.resolvedBy,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    version: c.version,
    etag: `"${c.version}"`,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toSyncChecklistResponse(r: ChecklistSyncStatusResult): SyncChecklistResponse {
  return {
    checklistType: r.checklistType,
    sourceId: r.sourceId,
    status: r.status,
    serverConfirmedAt: r.serverConfirmedAt ? r.serverConfirmedAt.toISOString() : null,
    stateVersion: r.stateVersion,
    openConflicts: r.openConflicts.map(toSyncConflictResponse),
  };
}

export function toSyncChecklistResultResponse(r: SyncChecklistResult): SyncChecklistResultResponse {
  return {
    checklistType: r.checklistType,
    sourceId: r.sourceId,
    status: r.status,
    serverConfirmedAt: r.serverConfirmedAt ? r.serverConfirmedAt.toISOString() : null,
    stateVersion: r.stateVersion,
    openConflicts: r.conflicts.map(toSyncConflictResponse),
    appliedFields: r.appliedFields,
    unchangedFields: r.unchangedFields,
    discardedFields: r.discardedFields,
    addedEvidence: r.addedEvidence,
    duplicateEvidence: r.duplicateEvidence,
  };
}

export function toResolveSyncConflictResponse(r: ResolveSyncConflictResult): ResolveSyncConflictResponse {
  return {
    conflict: toSyncConflictResponse(r.conflict),
    checklistStatus: r.checklistStatus,
    serverConfirmedAt: r.serverConfirmedAt ? r.serverConfirmedAt.toISOString() : null,
    openConflicts: r.openConflicts,
  };
}
