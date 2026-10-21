import { Injectable } from '@nestjs/common';
import { SyncConflictRecord, SyncStateRepositoryPort } from '../ports/sync-state-repository.port';
import { SyncAccessService } from '../services/sync-access.service';
import { ListSyncConflictsQuery } from './sync-queries';

/** GET /sync/conflicts - lista de conflictos del Centro de sincronizacion (TR-08), acotada a la empresa del contexto. */
@Injectable()
export class ListSyncConflictsHandler {
  constructor(
    private readonly access: SyncAccessService,
    private readonly states: SyncStateRepositoryPort,
  ) {}

  async execute(query: ListSyncConflictsQuery): Promise<SyncConflictRecord[]> {
    const { scope } = await this.access.authorize(query, query.checklistType, 'READ');
    return this.states.listConflicts({
      scope,
      checklistType: query.checklistType,
      sourceId: query.sourceId,
      status: query.status,
    });
  }
}
