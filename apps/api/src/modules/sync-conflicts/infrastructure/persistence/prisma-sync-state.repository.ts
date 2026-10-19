import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SyncChecklistState as SyncChecklistStateRow, SyncConflict as SyncConflictRow } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ListSyncConflictsFilter,
  NewSyncConflict,
  ResolveSyncConflictInput,
  SaveSyncStateInput,
  SyncChecklistState,
  SyncConflictRecord,
  SyncScope,
  SyncStateRepositoryPort,
} from '../../application/ports/sync-state-repository.port';
import { SyncConflictVersionMismatchError } from '../../domain/sync-errors';
import type {
  SyncChecklistStatus,
  SyncChecklistType,
  SyncConflictKind,
  SyncConflictStatus,
  SyncEvidenceEntry,
  SyncFieldVersion,
  SyncResolution,
  SyncServerField,
} from '../../domain/sync-types';

function toState(row: SyncChecklistStateRow): SyncChecklistState {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    checklistType: row.checklistType as SyncChecklistType,
    sourceId: row.sourceId,
    rentalId: row.rentalId,
    status: row.status as SyncChecklistStatus,
    version: row.version,
    fields: (row.fields ?? {}) as unknown as Record<string, SyncServerField>,
    evidence: (row.evidence ?? []) as unknown as SyncEvidenceEntry[],
    serverConfirmedAt: row.serverConfirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toConflict(row: SyncConflictRow): SyncConflictRecord {
  return {
    id: row.id,
    stateId: row.stateId,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    checklistType: row.checklistType as SyncChecklistType,
    sourceId: row.sourceId,
    rentalId: row.rentalId,
    kind: row.kind as SyncConflictKind,
    key: row.key,
    serverVersion: row.serverVersion as unknown as SyncFieldVersion | SyncEvidenceEntry,
    localVersion: row.localVersion as unknown as SyncFieldVersion | SyncEvidenceEntry,
    localBaseRev: row.localBaseRev,
    status: row.status as SyncConflictStatus,
    resolution: (row.resolution as SyncResolution | null) ?? null,
    reason: row.reason,
    detectedBy: row.detectedBy,
    deviceId: row.deviceId,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
    version: row.version,
    createdAt: row.createdAt,
  };
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

/** Persistencia de sync_checklist_states / sync_conflicts (TR-08). Toda consulta lleva organization/company. */
@Injectable()
export class PrismaSyncStateRepository extends SyncStateRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findState(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: SyncScope,
    tx?: Prisma.TransactionClient,
  ): Promise<SyncChecklistState | null> {
    const row = await (tx ?? this.prisma).syncChecklistState.findFirst({
      where: {
        checklistType,
        sourceId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
      },
    });
    return row ? toState(row) : null;
  }

  async findStateById(id: string, tx?: Prisma.TransactionClient): Promise<SyncChecklistState | null> {
    const row = await (tx ?? this.prisma).syncChecklistState.findUnique({ where: { id } });
    return row ? toState(row) : null;
  }

  async getOrCreateState(
    input: { checklistType: SyncChecklistType; sourceId: string; rentalId: string; scope: SyncScope },
    tx: Prisma.TransactionClient,
  ): Promise<SyncChecklistState> {
    const row = await tx.syncChecklistState.upsert({
      where: { checklistType_sourceId: { checklistType: input.checklistType, sourceId: input.sourceId } },
      create: {
        organizationId: input.scope.organizationId,
        operatingCompanyId: input.scope.operatingCompanyId,
        branchId: input.scope.branchId,
        checklistType: input.checklistType,
        sourceId: input.sourceId,
        rentalId: input.rentalId,
      },
      update: {},
    });
    return toState(row);
  }

  async saveState(input: SaveSyncStateInput, tx: Prisma.TransactionClient): Promise<SyncChecklistState> {
    const result = await tx.syncChecklistState.updateMany({
      where: { id: input.id, version: input.expectedVersion },
      data: {
        fields: json(input.fields),
        evidence: json(input.evidence),
        status: input.status,
        serverConfirmedAt: input.serverConfirmedAt,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new SyncConflictVersionMismatchError();
    }
    const row = await tx.syncChecklistState.findUniqueOrThrow({ where: { id: input.id } });
    return toState(row);
  }

  async createConflicts(inputs: NewSyncConflict[], tx: Prisma.TransactionClient): Promise<SyncConflictRecord[]> {
    const created: SyncConflictRecord[] = [];
    for (const input of inputs) {
      const row = await tx.syncConflict.create({
        data: {
          stateId: input.stateId,
          organizationId: input.organizationId,
          operatingCompanyId: input.operatingCompanyId,
          branchId: input.branchId,
          checklistType: input.checklistType,
          sourceId: input.sourceId,
          rentalId: input.rentalId,
          kind: input.kind,
          key: input.key,
          serverVersion: json(input.serverVersion),
          localVersion: json(input.localVersion),
          localBaseRev: input.localBaseRev,
          detectedBy: input.detectedBy,
          deviceId: input.deviceId,
        },
      });
      created.push(toConflict(row));
    }
    return created;
  }

  async findConflictById(
    id: string,
    organizationId: string,
    operatingCompanyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SyncConflictRecord | null> {
    const row = await (tx ?? this.prisma).syncConflict.findFirst({ where: { id, organizationId, operatingCompanyId } });
    return row ? toConflict(row) : null;
  }

  async findOpenConflict(
    stateId: string,
    kind: SyncConflictKind,
    key: string,
    tx: Prisma.TransactionClient,
  ): Promise<SyncConflictRecord | null> {
    const row = await tx.syncConflict.findFirst({ where: { stateId, kind, key, status: 'OPEN' } });
    return row ? toConflict(row) : null;
  }

  async listConflicts(filter: ListSyncConflictsFilter): Promise<SyncConflictRecord[]> {
    const rows = await this.prisma.syncConflict.findMany({
      where: {
        organizationId: filter.scope.organizationId,
        operatingCompanyId: filter.scope.operatingCompanyId,
        branchId: filter.scope.branchId,
        checklistType: filter.checklistType,
        ...(filter.sourceId ? { sourceId: filter.sourceId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
    return rows.map(toConflict);
  }

  async listOpenConflictsByState(stateId: string, tx?: Prisma.TransactionClient): Promise<SyncConflictRecord[]> {
    const rows = await (tx ?? this.prisma).syncConflict.findMany({
      where: { stateId, status: 'OPEN' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toConflict);
  }

  countOpenConflictsBySource(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: { organizationId: string; operatingCompanyId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return (tx ?? this.prisma).syncConflict.count({
      where: {
        checklistType,
        sourceId,
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        status: 'OPEN',
      },
    });
  }

  async resolveConflict(input: ResolveSyncConflictInput, tx: Prisma.TransactionClient): Promise<SyncConflictRecord> {
    const result = await tx.syncConflict.updateMany({
      where: { id: input.id, version: input.expectedVersion, status: 'OPEN' },
      data: {
        status: 'RESOLVED',
        resolution: input.resolution,
        reason: input.reason,
        resolvedBy: input.resolvedBy,
        resolvedAt: input.resolvedAt,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new SyncConflictVersionMismatchError();
    }
    const row = await tx.syncConflict.findUniqueOrThrow({ where: { id: input.id } });
    return toConflict(row);
  }
}
