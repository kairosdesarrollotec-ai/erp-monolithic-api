import type { SyncChecklistType } from '../../domain/sync-types';
import type { SyncScope } from './sync-state-repository.port';

export interface SyncSourceRecord {
  sourceId: string;
  /** Alquiler asociado: id del alquiler (ENTREGA) o `returns.rental_id` (RECEPCION). */
  rentalId: string;
  status: string;
  /** false si el expediente ya fue confirmado/cerrado/cancelado: SDD 17.3 "rechazar borrador incompatible". */
  acceptsDrafts: boolean;
}

/** Lectura del expediente (alquiler o devolucion) sobre el que se sincroniza el checklist. Solo lectura. */
export abstract class SyncSourcePort {
  abstract find(checklistType: SyncChecklistType, sourceId: string, scope: SyncScope): Promise<SyncSourceRecord | null>;
}
