import { Injectable } from '@nestjs/common';
import { SyncSourceNotFoundError } from '../../domain/sync-errors';
import type { SyncChecklistStatus } from '../../domain/sync-types';
import { SyncChecklistState, SyncConflictRecord, SyncStateRepositoryPort } from '../ports/sync-state-repository.port';
import { SyncSourcePort } from '../ports/sync-source.port';
import { SyncAccessService } from '../services/sync-access.service';
import { GetChecklistSyncStatusQuery } from './sync-queries';

export interface ChecklistSyncStatusResult {
  checklistType: GetChecklistSyncStatusQuery['checklistType'];
  sourceId: string;
  /** SYNCED solo si el servidor lo confirmo y no hay conflictos abiertos; sin estado previo => SYNCED sin confirmacion offline. */
  status: SyncChecklistStatus;
  serverConfirmedAt: Date | null;
  stateVersion: number | null;
  state: SyncChecklistState | null;
  openConflicts: SyncConflictRecord[];
}

/** GET /sync/checklists/{type}/{sourceId} - estado que la pantalla TR-08 / ENTREGA-04 / DEV-04 muestra (el servidor manda). */
@Injectable()
export class GetChecklistSyncStatusHandler {
  constructor(
    private readonly access: SyncAccessService,
    private readonly sources: SyncSourcePort,
    private readonly states: SyncStateRepositoryPort,
  ) {}

  async execute(query: GetChecklistSyncStatusQuery): Promise<ChecklistSyncStatusResult> {
    const { scope } = await this.access.authorize(query, query.checklistType, 'READ');
    const source = await this.sources.find(query.checklistType, query.sourceId, scope);
    if (!source) {
      throw new SyncSourceNotFoundError(query.checklistType, query.sourceId);
    }
    const state = await this.states.findState(query.checklistType, query.sourceId, scope);
    const openConflicts = state ? await this.states.listOpenConflictsByState(state.id) : [];
    return {
      checklistType: query.checklistType,
      sourceId: query.sourceId,
      status: state ? state.status : 'SYNCED',
      serverConfirmedAt: state?.serverConfirmedAt ?? null,
      stateVersion: state?.version ?? null,
      state,
      openConflicts,
    };
  }
}
