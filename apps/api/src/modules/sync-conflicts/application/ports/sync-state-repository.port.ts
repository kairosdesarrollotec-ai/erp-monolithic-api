import type { Prisma } from '@prisma/client';
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

export interface SyncScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface SyncChecklistState {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  checklistType: SyncChecklistType;
  sourceId: string;
  rentalId: string;
  status: SyncChecklistStatus;
  version: number;
  fields: Record<string, SyncServerField>;
  evidence: SyncEvidenceEntry[];
  serverConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConflictRecord {
  id: string;
  stateId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  checklistType: SyncChecklistType;
  sourceId: string;
  rentalId: string;
  kind: SyncConflictKind;
  /** Campo del checklist, o `zona#slot` para una toma. */
  key: string;
  /** Version del servidor / del dispositivo: SyncFieldVersion (FIELD) o SyncEvidenceEntry (EVIDENCE). */
  serverVersion: SyncFieldVersion | SyncEvidenceEntry;
  localVersion: SyncFieldVersion | SyncEvidenceEntry;
  /** Revision base declarada por el dispositivo (solo FIELD). */
  localBaseRev: number | null;
  status: SyncConflictStatus;
  resolution: SyncResolution | null;
  reason: string | null;
  detectedBy: string;
  deviceId: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  version: number;
  createdAt: Date;
}

export type NewSyncConflict = Omit<
  SyncConflictRecord,
  'id' | 'status' | 'resolution' | 'reason' | 'resolvedBy' | 'resolvedAt' | 'version' | 'createdAt'
>;

export interface SaveSyncStateInput {
  id: string;
  expectedVersion: number;
  fields: Record<string, SyncServerField>;
  evidence: SyncEvidenceEntry[];
  status: SyncChecklistStatus;
  serverConfirmedAt: Date | null;
}

export interface ResolveSyncConflictInput {
  id: string;
  expectedVersion: number;
  resolution: SyncResolution;
  reason: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export interface ListSyncConflictsFilter {
  scope: SyncScope;
  checklistType: SyncChecklistType;
  sourceId?: string;
  status?: SyncConflictStatus;
}

export abstract class SyncStateRepositoryPort {
  abstract findState(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: SyncScope,
    tx?: Prisma.TransactionClient,
  ): Promise<SyncChecklistState | null>;

  abstract findStateById(id: string, tx?: Prisma.TransactionClient): Promise<SyncChecklistState | null>;

  /** Crea el estado SYNCED vacio si no existe (idempotente por tipo+expediente). */
  abstract getOrCreateState(
    input: { checklistType: SyncChecklistType; sourceId: string; rentalId: string; scope: SyncScope },
    tx: Prisma.TransactionClient,
  ): Promise<SyncChecklistState>;

  /** Control optimista: lanza SyncConflictVersionMismatchError si la version cambio. Incrementa `version`. */
  abstract saveState(input: SaveSyncStateInput, tx: Prisma.TransactionClient): Promise<SyncChecklistState>;

  abstract createConflicts(inputs: NewSyncConflict[], tx: Prisma.TransactionClient): Promise<SyncConflictRecord[]>;

  abstract findConflictById(
    id: string,
    organizationId: string,
    operatingCompanyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SyncConflictRecord | null>;

  abstract findOpenConflict(
    stateId: string,
    kind: SyncConflictKind,
    key: string,
    tx: Prisma.TransactionClient,
  ): Promise<SyncConflictRecord | null>;

  abstract listConflicts(filter: ListSyncConflictsFilter): Promise<SyncConflictRecord[]>;

  abstract listOpenConflictsByState(stateId: string, tx?: Prisma.TransactionClient): Promise<SyncConflictRecord[]>;

  abstract countOpenConflictsBySource(
    checklistType: SyncChecklistType,
    sourceId: string,
    scope: { organizationId: string; operatingCompanyId: string },
    tx?: Prisma.TransactionClient,
  ): Promise<number>;

  /** Control optimista por version del conflicto (If-Match). */
  abstract resolveConflict(input: ResolveSyncConflictInput, tx: Prisma.TransactionClient): Promise<SyncConflictRecord>;
}
