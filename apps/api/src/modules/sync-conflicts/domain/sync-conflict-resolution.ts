import {
  SyncConfirmationRequiredError,
  SyncMergeNotAllowedError,
  SyncReasonRequiredError,
} from './sync-errors';
import {
  SYNC_REASON_MAX_LENGTH,
  SYNC_REASON_MIN_LENGTH,
  type SyncConflictKind,
  type SyncEvidenceEntry,
  type SyncResolution,
  type SyncScalar,
  type SyncServerField,
} from './sync-types';

export interface ResolutionInput {
  resolution: SyncResolution;
  reason: string | null | undefined;
  confirmed: boolean | null | undefined;
}

/**
 * Reglas de TR-08 / ENTREGA-04: la resolucion exige confirmacion EXPLICITA (nunca preseleccionada, nunca implicita)
 * y un `reason` (Value Object Reason, TDD-TRANS 7.1). Devuelve el motivo normalizado.
 */
export function assertResolutionInput(input: ResolutionInput): string {
  if (input.confirmed !== true) {
    throw new SyncConfirmationRequiredError();
  }
  const reason = (input.reason ?? '').trim();
  if (reason.length < SYNC_REASON_MIN_LENGTH || reason.length > SYNC_REASON_MAX_LENGTH) {
    throw new SyncReasonRequiredError(SYNC_REASON_MIN_LENGTH, SYNC_REASON_MAX_LENGTH);
  }
  return reason;
}

/** "Combinar" solo si no chocan: un campo del checklist en conflicto SIEMPRE choca; las evidencias son aditivas y si combinan. */
export function assertMergeAllowed(kind: SyncConflictKind, resolution: SyncResolution): void {
  if (resolution === 'MERGE' && kind === 'FIELD') {
    throw new SyncMergeNotAllowedError(
      'Combinar solo aplica cuando los datos no chocan: el mismo campo modificado por dos actores se resuelve conservando una de las dos versiones.',
    );
  }
}

export function canMerge(kind: SyncConflictKind): boolean {
  return kind === 'EVIDENCE';
}

/**
 * Campo en conflicto: KEEP_LOCAL escribe el valor del dispositivo (nueva revision, nunca se reutiliza una anterior);
 * KEEP_SERVER no cambia nada. Devuelve el campo resultante.
 */
export function resolveFieldConflict(
  serverField: SyncServerField,
  localValue: SyncScalar,
  resolution: SyncResolution,
  resolvedBy: string,
  nowIso: string,
): SyncServerField {
  assertMergeAllowed('FIELD', resolution);
  if (resolution === 'KEEP_SERVER') return serverField;
  return { value: localValue, rev: serverField.rev + 1, updatedBy: resolvedBy, updatedAt: nowIso };
}

/**
 * Evidencia en conflicto (zona+slot): NUNCA se borra ninguna toma.
 *  - KEEP_LOCAL: la toma del dispositivo pasa a PRIMARY y la del servidor queda ARCHIVED (auditable);
 *  - KEEP_SERVER: la toma del dispositivo queda ARCHIVED;
 *  - MERGE: ambas se conservan: la del servidor sigue PRIMARY y la del dispositivo pasa a ANNEX (sellos de tiempo propios).
 */
export function resolveEvidenceConflict(
  entries: readonly SyncEvidenceEntry[],
  local: SyncEvidenceEntry,
  resolution: SyncResolution,
): SyncEvidenceEntry[] {
  const without = entries.filter((e) => e.clientCaptureId !== local.clientCaptureId);
  const incoming = (role: SyncEvidenceEntry['role']): SyncEvidenceEntry => ({ ...local, role });
  switch (resolution) {
    case 'KEEP_LOCAL':
      return [
        ...without.map((e) => (e.zone === local.zone && e.slot === local.slot && e.role === 'PRIMARY' ? { ...e, role: 'ARCHIVED' as const } : e)),
        incoming('PRIMARY'),
      ];
    case 'KEEP_SERVER':
      return [...without, incoming('ARCHIVED')];
    case 'MERGE':
      return [...without, incoming('ANNEX')];
  }
}
