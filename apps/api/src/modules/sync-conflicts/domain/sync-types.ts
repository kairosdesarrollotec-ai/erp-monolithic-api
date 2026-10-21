/**
 * TR-08 / SDD-KAIROS-TRANSVERSAL 17 - tipos del contrato de conflictos de sincronizacion offline.
 *
 * Solo hay DOS checklists offline autorizados (SDD 17.1): la ENTREGA del alquiler (ENTREGA-04) y la
 * RECEPCION de la devolucion (DEV-04). `LOCAL_DRAFT` y `SYNCING` son estados del DISPOSITIVO; el servidor solo
 * conoce `SYNCED` (confirmado por el) y `SYNC_CONFLICT` ("solo la confirmacion del servidor cambia el estado
 * visible a sincronizado", SDD 17.2 punto 5).
 */
export const SYNC_CHECKLIST_TYPES = ['ENTREGA', 'RECEPCION'] as const;
export type SyncChecklistType = (typeof SYNC_CHECKLIST_TYPES)[number];

export type SyncChecklistStatus = 'SYNCED' | 'SYNC_CONFLICT';

/** Tipos de dato de la matriz de conflicto (SDD 17.4). `EVIDENCE` viaja en su propio arreglo, no como campo. */
export const SYNC_FIELD_DATA_TYPES = [
  'CHECKLIST',
  'AVAILABILITY',
  'RESERVATION',
  'VEHICLE_STATE',
  'PAYMENT',
  'EMPLOYEE',
  'CRITICAL_DELETE',
] as const;
export type SyncFieldDataType = (typeof SYNC_FIELD_DATA_TYPES)[number];

export type SyncConflictKind = 'FIELD' | 'EVIDENCE';
export type SyncConflictStatus = 'OPEN' | 'RESOLVED';

/** Acciones de la pantalla TR-08 / ENTREGA-04: "Conservar la mia", "Conservar del servidor", "Combinar". */
export const SYNC_RESOLUTIONS = ['KEEP_LOCAL', 'KEEP_SERVER', 'MERGE'] as const;
export type SyncResolution = (typeof SYNC_RESOLUTIONS)[number];

/** TTL aprobado del checklist/borrador offline (SDD 17.4): 72 h. */
export const SYNC_DRAFT_TTL_HOURS = 72;

/** `Reason` (TDD-KAIROS-TRANSVERSAL 7.1): motivo obligatorio; mismo minimo (10) que otras excepciones del backend. */
export const SYNC_REASON_MIN_LENGTH = 10;
export const SYNC_REASON_MAX_LENGTH = 500;

export type SyncScalar = string | number | boolean | null;

/** Valor vigente de un campo del checklist en el servidor, con su revision (control optimista por campo). */
export interface SyncServerField {
  value: SyncScalar;
  rev: number;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Revision vigente de un campo en el servidor (sync.yaml 1.1.0, DEC-SYNC-10): el dispositivo la guarda y la usa como
 * `baseRev` de su siguiente edicion, para no chocar contra su propio cambio ya sincronizado.
 */
export interface SyncFieldRevision {
  key: string;
  rev: number;
  value: SyncScalar;
}

export function toFieldRevisions(fields: Readonly<Record<string, SyncServerField>>): SyncFieldRevision[] {
  return Object.keys(fields)
    .sort()
    .map((key) => ({ key, rev: fields[key].rev, value: fields[key].value }));
}

export type SyncEvidenceType = 'PHOTO' | 'VIDEO';
/** PRIMARY = toma vigente; ANNEX = segunda toma conservada con "Combinar"; ARCHIVED = reemplazada (nunca se borra). */
export type SyncEvidenceRole = 'PRIMARY' | 'ANNEX' | 'ARCHIVED';

export interface SyncEvidenceEntry {
  clientCaptureId: string;
  zone: string;
  slot: number;
  type: SyncEvidenceType;
  contentHash: string;
  sizeBytes: number | null;
  capturedBy: string;
  capturedAt: string;
  deviceId: string | null;
  role: SyncEvidenceRole;
}

/** Instantanea de una de las dos versiones de un conflicto (lo que muestra la tarjeta "Tu version" / "Version del servidor"). */
export interface SyncFieldVersion {
  value: SyncScalar;
  by: string;
  at: string;
  deviceId?: string | null;
}
