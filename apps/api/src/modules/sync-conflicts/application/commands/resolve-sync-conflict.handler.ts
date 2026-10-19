import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import {
  assertMergeAllowed,
  assertResolutionInput,
  resolveEvidenceConflict,
  resolveFieldConflict,
} from '../../domain/sync-conflict-resolution';
import { deriveChecklistStatus } from '../../domain/sync-closure-gate';
import {
  SyncConflictAlreadyResolvedError,
  SyncConflictNotFoundError,
  SyncConflictVersionMismatchError,
} from '../../domain/sync-errors';
import type {
  SyncChecklistStatus,
  SyncEvidenceEntry,
  SyncFieldVersion,
  SyncServerField,
} from '../../domain/sync-types';
import { SyncConflictRecord, SyncStateRepositoryPort } from '../ports/sync-state-repository.port';
import { SyncAccessService } from '../services/sync-access.service';
import { syncAuditRef } from '../sync-audit-ref';
import { ResolveSyncConflictCommand } from './resolve-sync-conflict.command';

export interface ResolveSyncConflictResult {
  conflict: SyncConflictRecord;
  checklistStatus: SyncChecklistStatus;
  serverConfirmedAt: Date | null;
  openConflicts: number;
}

/**
 * TR-08 / ENTREGA-04 - "Conservar la mia" | "Conservar del servidor" | "Combinar" (solo evidencias: los campos que
 * chocan no se combinan). Exige: rol supervisor (accion ADM-02 existente, ver SYNC_PERMISSION_MAP), If-Match con la
 * version del conflicto, `confirmed=true` y `reason`. SIEMPRE audita y publica evento outbox. Nunca se invoca solo:
 * no hay ningun camino automatico que resuelva un conflicto.
 */
@Injectable()
export class ResolveSyncConflictHandler {
  constructor(
    private readonly access: SyncAccessService,
    private readonly states: SyncStateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: ResolveSyncConflictCommand): Promise<ResolveSyncConflictResult> {
    const context = await this.access.authorizeContext(command);
    const found = await this.states.findConflictById(command.conflictId, context.organizationId, command.companyId);
    if (!found || found.branchId !== command.branchId) {
      throw new SyncConflictNotFoundError(command.conflictId);
    }
    await this.access.assertAction(context, found.checklistType, 'RESOLVE');

    if (found.status === 'RESOLVED') {
      throw new SyncConflictAlreadyResolvedError(found.id);
    }
    if (found.version !== command.expectedVersion) {
      throw new SyncConflictVersionMismatchError();
    }
    const reason = assertResolutionInput({
      resolution: command.resolution,
      reason: command.reason,
      confirmed: command.confirmed,
    });
    assertMergeAllowed(found.kind, command.resolution);

    const now = this.clock.now();
    const nowIso = now.toISOString();

    return this.transactionManager.run(
      async (tx) => {
        const conflict = await this.states.findConflictById(command.conflictId, context.organizationId, command.companyId, tx);
        if (!conflict) throw new SyncConflictNotFoundError(command.conflictId);
        if (conflict.status === 'RESOLVED') throw new SyncConflictAlreadyResolvedError(conflict.id);
        if (conflict.version !== command.expectedVersion) throw new SyncConflictVersionMismatchError();

        const state = await this.states.findStateById(conflict.stateId, tx);
        if (!state) throw new SyncConflictNotFoundError(command.conflictId);

        let fields: Record<string, SyncServerField> = state.fields;
        let evidence: SyncEvidenceEntry[] = state.evidence;
        if (conflict.kind === 'FIELD') {
          const current = state.fields[conflict.key];
          if (current) {
            fields = {
              ...state.fields,
              [conflict.key]: resolveFieldConflict(
                current,
                (conflict.localVersion as SyncFieldVersion).value,
                command.resolution,
                command.firebaseUid,
                nowIso,
              ),
            };
          }
        } else {
          evidence = resolveEvidenceConflict(state.evidence, conflict.localVersion as SyncEvidenceEntry, command.resolution);
        }

        const resolved = await this.states.resolveConflict(
          {
            id: conflict.id,
            expectedVersion: command.expectedVersion,
            resolution: command.resolution,
            reason,
            resolvedBy: command.firebaseUid,
            resolvedAt: now,
          },
          tx,
        );
        const remaining = (await this.states.listOpenConflictsByState(state.id, tx)).length;
        const status = deriveChecklistStatus(remaining);
        const serverConfirmedAt = status === 'SYNCED' ? now : null;
        const saved = await this.states.saveState(
          { id: state.id, expectedVersion: state.version, fields, evidence, status, serverConfirmedAt },
          tx,
        );

        const changes = {
          conflictId: conflict.id,
          auditRef: syncAuditRef(conflict.id),
          checklistType: conflict.checklistType,
          sourceId: conflict.sourceId,
          kind: conflict.kind,
          key: conflict.key,
          resolution: command.resolution,
          reason,
          serverVersion: conflict.serverVersion,
          localVersion: conflict.localVersion,
          checklistStatus: status,
          openConflicts: remaining,
        };
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: context.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: conflict.rentalId,
            action: 'SYNC_CONFLICT_RESOLVED',
            changes,
          },
          tx,
        );
        await this.outboxRepository.publish(
          {
            aggregateType: 'sync_checklist',
            aggregateId: saved.id,
            eventType: 'ConflictoSincronizacionResuelto.v1',
            payload: {
              ...changes,
              organizationId: context.organizationId,
              operatingCompanyId: context.companyId,
              branchId: context.branchId,
              rentalId: conflict.rentalId,
            },
          },
          tx,
        );

        return { conflict: resolved, checklistStatus: status, serverConfirmedAt, openConflicts: remaining };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
