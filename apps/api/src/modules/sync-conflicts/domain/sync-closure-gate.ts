import { SyncConflictPendingError } from './sync-errors';
import type { SyncChecklistStatus, SyncChecklistType } from './sync-types';

/** Estado visible que confirma el servidor: SYNCED solo si no queda ningun conflicto abierto. */
export function deriveChecklistStatus(openConflicts: number): SyncChecklistStatus {
  return openConflicts > 0 ? 'SYNC_CONFLICT' : 'SYNCED';
}

/**
 * Cierre de la inspeccion (Devolucion, "Continuar a Resultado") / de la entrega: bloqueado hasta SYNCED confirmado
 * por el servidor. Un expediente que nunca uso el flujo offline (sin estado de sincronizacion) no se bloquea.
 */
export function assertSyncedForClosure(
  checklistType: SyncChecklistType,
  state: { openConflicts: number } | null,
): void {
  if (state && state.openConflicts > 0) {
    throw new SyncConflictPendingError(checklistType, state.openConflicts);
  }
}
