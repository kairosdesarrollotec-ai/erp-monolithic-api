import { SyncPayloadInvalidError } from './sync-errors';
import type { IncomingField } from './sync-conflict-matrix';
import type { SyncScalar, SyncServerField } from './sync-types';

export interface FieldToApply {
  key: string;
  value: SyncScalar;
}

export interface FieldClash {
  key: string;
  server: SyncServerField;
  local: { value: SyncScalar; baseRev: number; editedAt: string };
}

export interface ChecklistMergeResult {
  /** Campos que solo cambio el dispositivo: se aplican (merge de "campos distintos"). */
  toApply: FieldToApply[];
  /** Campos cuyo valor ya coincide con el del servidor: nada que hacer. */
  unchanged: string[];
  /** Mismo campo, valores distintos, modificado por dos actores desde la revision base: requiere supervisor. */
  clashes: FieldClash[];
}

/**
 * Merge por campo de 3 vias con revision base (SDD 17.4, Checklist):
 *  - el servidor no conoce el campo, o su revision == la base del dispositivo -> solo cambio el dispositivo: se aplica;
 *  - mismo valor -> converge, sin cambios;
 *  - el servidor avanzo (rev > baseRev) Y el valor difiere -> CHOQUE (dos actores sobre el mismo campo);
 *  - baseRev > rev del servidor es imposible (el dispositivo nunca vio esa revision) -> payload invalido.
 * Funcion pura: no decide por antiguedad ni por "ultimo gana" - un choque nunca se resuelve solo.
 */
export function mergeChecklistFields(
  server: Readonly<Record<string, SyncServerField>>,
  incoming: readonly Pick<IncomingField, 'key' | 'value' | 'baseRev' | 'editedAt'>[],
): ChecklistMergeResult {
  const seen = new Set<string>();
  const result: ChecklistMergeResult = { toApply: [], unchanged: [], clashes: [] };

  for (const field of incoming) {
    if (seen.has(field.key)) {
      throw new SyncPayloadInvalidError(`El campo ${field.key} viene repetido en la sincronizacion.`);
    }
    seen.add(field.key);

    const current = server[field.key];
    if (!current) {
      result.toApply.push({ key: field.key, value: field.value });
      continue;
    }
    if (field.baseRev > current.rev) {
      throw new SyncPayloadInvalidError(
        `El campo ${field.key} declara una revision base (${field.baseRev}) mayor que la del servidor (${current.rev}).`,
      );
    }
    if (current.value === field.value) {
      result.unchanged.push(field.key);
    } else if (field.baseRev === current.rev) {
      result.toApply.push({ key: field.key, value: field.value });
    } else {
      result.clashes.push({
        key: field.key,
        server: current,
        local: { value: field.value, baseRev: field.baseRev, editedAt: field.editedAt },
      });
    }
  }
  return result;
}
