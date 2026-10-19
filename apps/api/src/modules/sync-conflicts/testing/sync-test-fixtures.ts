import { SyncConflictVersionMismatchError } from '../domain/sync-errors';
import type { SyncChecklistType } from '../domain/sync-types';
import {
  NewSyncConflict,
  ResolveSyncConflictInput,
  SaveSyncStateInput,
  SyncChecklistState,
  SyncConflictRecord,
  SyncScope,
  SyncStateRepositoryPort,
  ListSyncConflictsFilter,
} from '../application/ports/sync-state-repository.port';

export const SYNC_SCOPE: SyncScope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };
export const SYNC_NOW = new Date('2026-10-19T15:00:00.000Z');
export const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
export const RENTAL_ID = '22222222-2222-4222-8222-222222222222';

/** Repositorio en memoria con el mismo contrato de versionado optimista que el adaptador Prisma. */
export class InMemorySyncStateRepository extends SyncStateRepositoryPort {
  states: SyncChecklistState[] = [];
  conflicts: SyncConflictRecord[] = [];
  private seq = 0;

  findState(type: SyncChecklistType, sourceId: string): Promise<SyncChecklistState | null> {
    return Promise.resolve(this.states.find((s) => s.checklistType === type && s.sourceId === sourceId) ?? null);
  }

  findStateById(id: string): Promise<SyncChecklistState | null> {
    return Promise.resolve(this.states.find((s) => s.id === id) ?? null);
  }

  async getOrCreateState(input: {
    checklistType: SyncChecklistType;
    sourceId: string;
    rentalId: string;
    scope: SyncScope;
  }): Promise<SyncChecklistState> {
    const existing = await this.findState(input.checklistType, input.sourceId);
    if (existing) return existing;
    const state: SyncChecklistState = {
      id: `state-${++this.seq}`,
      ...input.scope,
      checklistType: input.checklistType,
      sourceId: input.sourceId,
      rentalId: input.rentalId,
      status: 'SYNCED',
      version: 1,
      fields: {},
      evidence: [],
      serverConfirmedAt: null,
      createdAt: SYNC_NOW,
      updatedAt: SYNC_NOW,
    };
    this.states.push(state);
    return state;
  }

  saveState(input: SaveSyncStateInput): Promise<SyncChecklistState> {
    const state = this.states.find((s) => s.id === input.id);
    if (!state || state.version !== input.expectedVersion) throw new SyncConflictVersionMismatchError();
    Object.assign(state, {
      fields: input.fields,
      evidence: input.evidence,
      status: input.status,
      serverConfirmedAt: input.serverConfirmedAt,
      version: state.version + 1,
    });
    return Promise.resolve(state);
  }

  createConflicts(inputs: NewSyncConflict[]): Promise<SyncConflictRecord[]> {
    const created = inputs.map<SyncConflictRecord>((i) => ({
      ...i,
      id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`,
      status: 'OPEN',
      resolution: null,
      reason: null,
      resolvedBy: null,
      resolvedAt: null,
      version: 1,
      createdAt: SYNC_NOW,
    }));
    this.conflicts.push(...created);
    return Promise.resolve(created);
  }

  findConflictById(id: string, organizationId: string, operatingCompanyId: string): Promise<SyncConflictRecord | null> {
    return Promise.resolve(
      this.conflicts.find((c) => c.id === id && c.organizationId === organizationId && c.operatingCompanyId === operatingCompanyId) ?? null,
    );
  }

  findOpenConflict(stateId: string, kind: string, key: string): Promise<SyncConflictRecord | null> {
    return Promise.resolve(this.conflicts.find((c) => c.stateId === stateId && c.kind === kind && c.key === key && c.status === 'OPEN') ?? null);
  }

  listConflicts(filter: ListSyncConflictsFilter): Promise<SyncConflictRecord[]> {
    return Promise.resolve(
      this.conflicts.filter(
        (c) =>
          c.organizationId === filter.scope.organizationId &&
          c.checklistType === filter.checklistType &&
          (!filter.sourceId || c.sourceId === filter.sourceId) &&
          (!filter.status || c.status === filter.status),
      ),
    );
  }

  listOpenConflictsByState(stateId: string): Promise<SyncConflictRecord[]> {
    return Promise.resolve(this.conflicts.filter((c) => c.stateId === stateId && c.status === 'OPEN'));
  }

  countOpenConflictsBySource(type: SyncChecklistType, sourceId: string): Promise<number> {
    return Promise.resolve(this.conflicts.filter((c) => c.checklistType === type && c.sourceId === sourceId && c.status === 'OPEN').length);
  }

  resolveConflict(input: ResolveSyncConflictInput): Promise<SyncConflictRecord> {
    const conflict = this.conflicts.find((c) => c.id === input.id);
    if (!conflict || conflict.version !== input.expectedVersion || conflict.status !== 'OPEN') throw new SyncConflictVersionMismatchError();
    Object.assign(conflict, {
      status: 'RESOLVED',
      resolution: input.resolution,
      reason: input.reason,
      resolvedBy: input.resolvedBy,
      resolvedAt: input.resolvedAt,
      version: conflict.version + 1,
    });
    return Promise.resolve(conflict);
  }
}
