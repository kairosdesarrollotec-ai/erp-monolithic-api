import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { assertSyncedForClosure } from '../../domain/sync-closure-gate';
import type { SyncChecklistType } from '../../domain/sync-types';
import { SyncClosureGatePort } from '../ports/sync-closure-gate.port';
import { SyncStateRepositoryPort } from '../ports/sync-state-repository.port';

@Injectable()
export class SyncClosureGateService extends SyncClosureGatePort {
  constructor(private readonly states: SyncStateRepositoryPort) {
    super();
  }

  async assertSynced(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: { organizationId: string; operatingCompanyId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const openConflicts = await this.states.countOpenConflictsBySource(checklistType, sourceId, scope, tx);
    assertSyncedForClosure(checklistType, { openConflicts });
  }
}
