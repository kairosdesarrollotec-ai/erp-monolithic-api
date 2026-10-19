import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { classifyIncomingFields, type DiscardedField } from '../../domain/sync-conflict-matrix';
import { mergeChecklistFields } from '../../domain/sync-checklist-merge';
import { mergeEvidence, type EvidenceDuplicate } from '../../domain/sync-evidence-merge';
import { deriveChecklistStatus } from '../../domain/sync-closure-gate';
import {
  SyncConflictAlreadyOpenError,
  SyncDraftExpiredError,
  SyncDraftRejectedError,
  SyncPayloadInvalidError,
  SyncSourceNotFoundError,
} from '../../domain/sync-errors';
import {
  SYNC_DRAFT_TTL_HOURS,
  type SyncChecklistStatus,
  type SyncEvidenceEntry,
  type SyncFieldVersion,
  type SyncServerField,
} from '../../domain/sync-types';
import {
  NewSyncConflict,
  SyncConflictRecord,
  SyncStateRepositoryPort,
} from '../ports/sync-state-repository.port';
import { SyncSourcePort } from '../ports/sync-source.port';
import { SyncAccessService } from '../services/sync-access.service';
import { syncAuditRef } from '../sync-audit-ref';
import { SyncChecklistCommand } from './sync-checklist.command';

const MS_PER_HOUR = 60 * 60 * 1000;

export interface SyncChecklistResult {
  checklistType: SyncChecklistCommand['checklistType'];
  sourceId: string;
  status: SyncChecklistStatus;
  /** Solo con SYNCED: instante en que el SERVIDOR confirmo (SDD 17.2 punto 5). */
  serverConfirmedAt: Date | null;
  stateVersion: number;
  appliedFields: string[];
  unchangedFields: string[];
  discardedFields: DiscardedField[];
  addedEvidence: string[];
  duplicateEvidence: EvidenceDuplicate[];
  /** Conflictos abiertos del checklist (nuevos y previos): nada se resuelve solo. */
  conflicts: SyncConflictRecord[];
}

/**
 * TR-08 / ENTREGA-04 / DEV-04 - sincroniza un borrador offline contra la version del servidor (SDD 17.2):
 * aplica la matriz de conflicto (SDD 17.4), combina campos distintos, deja evidencias aditivas sin duplicar por
 * `contentHash` y, ante un choque, crea un conflicto ABIERTO que SOLO un supervisor resuelve. Cada deteccion se
 * audita y publica su evento outbox. El estado SYNCED lo confirma unicamente este handler.
 */
@Injectable()
export class SyncChecklistHandler {
  constructor(
    private readonly access: SyncAccessService,
    private readonly sources: SyncSourcePort,
    private readonly states: SyncStateRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: SyncChecklistCommand): Promise<SyncChecklistResult> {
    const { scope } = await this.access.authorize(command, command.checklistType, 'CAPTURE');

    const source = await this.sources.find(command.checklistType, command.sourceId, scope);
    if (!source) {
      throw new SyncSourceNotFoundError(command.checklistType, command.sourceId);
    }
    if (!source.acceptsDrafts) {
      throw new SyncDraftRejectedError(command.checklistType, source.status);
    }

    const now = this.clock.now();
    if (now.getTime() - command.draftCreatedAt.getTime() > SYNC_DRAFT_TTL_HOURS * MS_PER_HOUR) {
      throw new SyncDraftExpiredError(SYNC_DRAFT_TTL_HOURS);
    }
    if (command.draftCreatedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new SyncPayloadInvalidError('draftCreatedAt esta en el futuro.');
    }
    if (command.fields.length === 0 && command.evidence.length === 0) {
      throw new SyncPayloadInvalidError('La sincronizacion no trae campos ni evidencias.');
    }

    const { checklist, discarded } = classifyIncomingFields(command.fields);
    const nowIso = now.toISOString();

    return this.transactionManager.run(
      async (tx) => {
        const state = await this.states.getOrCreateState(
          { checklistType: command.checklistType, sourceId: command.sourceId, rentalId: source.rentalId, scope },
          tx,
        );

        const fieldMerge = mergeChecklistFields(state.fields, checklist);
        const evidenceMerge = mergeEvidence(state.evidence, command.evidence);

        const fields: Record<string, SyncServerField> = { ...state.fields };
        for (const change of fieldMerge.toApply) {
          const previous = fields[change.key];
          fields[change.key] = {
            value: change.value,
            rev: (previous?.rev ?? 0) + 1,
            updatedBy: command.firebaseUid,
            updatedAt: nowIso,
          };
        }
        const evidence: SyncEvidenceEntry[] = [
          ...state.evidence,
          ...evidenceMerge.toAdd.map((e) => ({ ...e, capturedBy: command.firebaseUid, role: 'PRIMARY' as const })),
        ];

        // Conflictos nuevos (idempotentes: un reintento identico no duplica; uno distinto exige resolver antes).
        const newConflicts: NewSyncConflict[] = [];
        const base = {
          stateId: state.id,
          organizationId: scope.organizationId,
          operatingCompanyId: scope.operatingCompanyId,
          branchId: scope.branchId,
          checklistType: command.checklistType,
          sourceId: command.sourceId,
          rentalId: source.rentalId,
          detectedBy: command.firebaseUid,
          deviceId: command.deviceId,
        };
        for (const clash of fieldMerge.clashes) {
          const existing = await this.states.findOpenConflict(state.id, 'FIELD', clash.key, tx);
          const local: SyncFieldVersion = {
            value: clash.local.value,
            by: command.firebaseUid,
            at: clash.local.editedAt,
            deviceId: command.deviceId,
          };
          if (existing) {
            if ((existing.localVersion as SyncFieldVersion).value !== local.value) {
              throw new SyncConflictAlreadyOpenError(clash.key, existing.id);
            }
            continue;
          }
          newConflicts.push({
            ...base,
            kind: 'FIELD',
            key: clash.key,
            serverVersion: { value: clash.server.value, by: clash.server.updatedBy, at: clash.server.updatedAt },
            localVersion: local,
            localBaseRev: clash.local.baseRev,
          });
        }
        for (const clash of evidenceMerge.clashes) {
          const key = `${clash.zone}#${clash.slot}`;
          const existing = await this.states.findOpenConflict(state.id, 'EVIDENCE', key, tx);
          const local: SyncEvidenceEntry = { ...clash.local, capturedBy: command.firebaseUid, role: 'PRIMARY' };
          if (existing) {
            if ((existing.localVersion as SyncEvidenceEntry).contentHash !== local.contentHash) {
              throw new SyncConflictAlreadyOpenError(key, existing.id);
            }
            continue;
          }
          newConflicts.push({
            ...base,
            kind: 'EVIDENCE',
            key,
            serverVersion: clash.server,
            localVersion: local,
            localBaseRev: null,
          });
        }
        const created = await this.states.createConflicts(newConflicts, tx);

        const openConflicts = await this.states.listOpenConflictsByState(state.id, tx);
        const status = deriveChecklistStatus(openConflicts.length);
        const serverConfirmedAt = status === 'SYNCED' ? now : null;

        const saved = await this.states.saveState(
          { id: state.id, expectedVersion: state.version, fields, evidence, status, serverConfirmedAt },
          tx,
        );

        const changes = {
          checklistType: command.checklistType,
          sourceId: command.sourceId,
          deviceId: command.deviceId,
          status,
          appliedFields: fieldMerge.toApply.map((f) => f.key),
          discardedFields: discarded.map((d) => d.key),
          addedEvidence: evidenceMerge.toAdd.map((e) => e.clientCaptureId),
          duplicateEvidence: evidenceMerge.duplicates.map((d) => d.clientCaptureId),
          newConflicts: created.map((c) => ({ conflictId: c.id, kind: c.kind, key: c.key, auditRef: syncAuditRef(c.id) })),
        };
        await this.auditRepository.recordRentalEvent(
          {
            organizationId: scope.organizationId,
            actorUserId: command.firebaseUid,
            rentalId: source.rentalId,
            action: created.length > 0 ? 'SYNC_CONFLICT_DETECTED' : 'SYNC_CHECKLIST_SYNCED',
            changes,
          },
          tx,
        );
        await this.outboxRepository.publish(
          {
            aggregateType: 'sync_checklist',
            aggregateId: saved.id,
            eventType: created.length > 0 ? 'ConflictoSincronizacionDetectado.v1' : 'ChecklistSincronizado.v1',
            payload: {
              ...changes,
              organizationId: scope.organizationId,
              operatingCompanyId: scope.operatingCompanyId,
              branchId: scope.branchId,
              rentalId: source.rentalId,
              openConflicts: openConflicts.length,
            },
          },
          tx,
        );

        return {
          checklistType: command.checklistType,
          sourceId: command.sourceId,
          status,
          serverConfirmedAt,
          stateVersion: saved.version,
          appliedFields: fieldMerge.toApply.map((f) => f.key),
          unchangedFields: fieldMerge.unchanged,
          discardedFields: discarded,
          addedEvidence: evidenceMerge.toAdd.map((e) => e.clientCaptureId),
          duplicateEvidence: evidenceMerge.duplicates,
          conflicts: openConflicts.concat(created.filter((c) => !openConflicts.some((o) => o.id === c.id))),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
