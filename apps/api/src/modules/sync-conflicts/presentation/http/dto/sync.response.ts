import type { SyncFieldRevision, SyncChecklistStatus, SyncChecklistType, SyncConflictKind, SyncConflictStatus, SyncEvidenceEntry, SyncFieldVersion, SyncResolution } from '../../../domain/sync-types';

export interface SyncConflictResponse {
  id: string;
  /** Referencia de auditoria visible en la tarjeta (SYNC-ERR-XXXXXXXX). */
  auditRef: string;
  checklistType: SyncChecklistType;
  sourceId: string;
  rentalId: string;
  kind: SyncConflictKind;
  key: string;
  status: SyncConflictStatus;
  /** "Combinar" solo se habilita si los datos no chocan (evidencias); un campo en conflicto siempre choca. */
  canMerge: boolean;
  /** Columna "Version del servidor". */
  serverVersion: SyncFieldVersion | SyncEvidenceEntry;
  /** Columna "Tu version". */
  localVersion: SyncFieldVersion | SyncEvidenceEntry;
  resolution: SyncResolution | null;
  reason: string | null;
  detectedBy: string;
  deviceId: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  version: number;
  etag: string;
  createdAt: string;
}

export interface SyncChecklistResponse {
  checklistType: SyncChecklistType;
  sourceId: string;
  status: SyncChecklistStatus;
  serverConfirmedAt: string | null;
  stateVersion: number | null;
  openConflicts: SyncConflictResponse[];
  /** 1.1.0: revision vigente por campo; el dispositivo la usa como `baseRev` de su siguiente edicion. */
  fieldRevisions: SyncFieldRevision[];
}

export interface SyncChecklistResultResponse extends SyncChecklistResponse {
  appliedFields: string[];
  unchangedFields: string[];
  discardedFields: { key: string; dataType: string; code: string; detail: string }[];
  addedEvidence: string[];
  duplicateEvidence: { clientCaptureId: string; reason: string; existingClientCaptureId: string; existingSlot?: number }[];
  /** 1.1.0: slot definitivo de cada toma del lote. */
  evidenceSlots: { clientCaptureId: string; zone: string; slot: number; outcome: string; assignedByServer: boolean }[];
}

export interface ResolveSyncConflictResponse {
  conflict: SyncConflictResponse;
  checklistStatus: SyncChecklistStatus;
  serverConfirmedAt: string | null;
  openConflicts: number;
}
