import { SyncPayloadInvalidError } from './sync-errors';
import type { SyncEvidenceEntry } from './sync-types';

/**
 * Toma que informa el dispositivo. `slot` es OPCIONAL desde sync.yaml 1.1.0 (DEC-SYNC-11): ausente = el servidor asigna
 * el siguiente slot libre de la zona; presente = el dispositivo pide ese slot exacto (si esta ocupado por otra toma
 * PRIMARY con distinto contentHash, es conflicto).
 */
export type IncomingEvidence = Omit<SyncEvidenceEntry, 'role' | 'capturedBy' | 'slot'> & { slot?: number };

/** Toma con el slot ya definido (pedido por el dispositivo o asignado por el servidor). */
export type PlacedEvidence = Omit<IncomingEvidence, 'slot'> & { slot: number };

export interface EvidenceDuplicate {
  clientCaptureId: string;
  reason: 'SAME_CAPTURE' | 'SAME_CONTENT_HASH';
  existingClientCaptureId: string;
  /** Slot de la toma ya registrada (aditivo, 1.1.0): el dispositivo adopta ese slot para su copia local. */
  existingSlot?: number;
}

export interface EvidenceSlotAssignment {
  clientCaptureId: string;
  zone: string;
  slot: number;
  outcome: 'ADDED' | 'DUPLICATE' | 'CONFLICT';
  /** true si el servidor eligio el slot (el dispositivo no lo envio). */
  assignedByServer: boolean;
}

export interface EvidenceClash {
  zone: string;
  slot: number;
  server: SyncEvidenceEntry;
  local: PlacedEvidence;
}

export interface EvidenceMergeResult {
  /** Tomas en un slot libre: se agregan (evidencia ADITIVA). */
  toAdd: PlacedEvidence[];
  /** Mismo clientCaptureId o mismo contentHash: idempotente, NO se duplica (SDD 17.3 "archivo duplicado"). */
  duplicates: EvidenceDuplicate[];
  /** Slot ocupado con otro contentHash: nunca se sobrescribe en silencio -> conflicto. */
  clashes: EvidenceClash[];
  /** Slot definitivo de CADA toma del lote (agregada, duplicada o en conflicto), en el orden recibido. */
  assignments: EvidenceSlotAssignment[];
}

/**
 * Evidencias aditivas (SDD 17.4) + archivo duplicado se compara por integridad (`contentHash`) y no se duplica
 * (SDD 17.3). Una toma = (zone, slot). Funcion pura.
 *
 * Asignacion de slot (sync.yaml 1.1.0, DEC-SYNC-11): un archivo ya registrado (mismo `clientCaptureId` o mismo
 * `contentHash`) es SIEMPRE idempotente y devuelve el slot existente, aunque pida otro; una toma sin `slot` recibe el
 * siguiente libre de su zona (max + 1 sobre cualquier rol, incluidas las ARCHIVED y las del propio lote, por lo que
 * nunca reutiliza ni choca); solo una toma que PIDE un slot ocupado por otro hash genera conflicto.
 */
export function mergeEvidence(
  server: readonly SyncEvidenceEntry[],
  incoming: readonly IncomingEvidence[],
): EvidenceMergeResult {
  const result: EvidenceMergeResult = { toAdd: [], duplicates: [], clashes: [], assignments: [] };
  const batchCaptures = new Set<string>();
  const batchSlots = new Map<string, string>();
  const batchHashes = new Map<string, { clientCaptureId: string; zone: string; slot: number | undefined }>();
  const pendingAuto: { item: IncomingEvidence; index: number }[] = [];
  const outcomes: (EvidenceSlotAssignment | undefined)[] = new Array(incoming.length);
  const toAddByCapture = new Map<string, PlacedEvidence>();

  const place = (item: IncomingEvidence, slot: number, index: number, assignedByServer: boolean): void => {
    const occupant = server.find((e) => e.zone === item.zone && e.slot === slot && e.role === 'PRIMARY');
    const placed: PlacedEvidence = { ...item, slot };
    if (occupant) {
      result.clashes.push({ zone: item.zone, slot, server: occupant, local: placed });
      outcomes[index] = { clientCaptureId: item.clientCaptureId, zone: item.zone, slot, outcome: 'CONFLICT', assignedByServer };
    } else {
      result.toAdd.push(placed);
      toAddByCapture.set(item.clientCaptureId, placed);
      outcomes[index] = { clientCaptureId: item.clientCaptureId, zone: item.zone, slot, outcome: 'ADDED', assignedByServer };
    }
  };

  incoming.forEach((item, index) => {
    if (batchCaptures.has(item.clientCaptureId)) {
      throw new SyncPayloadInvalidError(`clientCaptureId ${item.clientCaptureId} repetido en la sincronizacion.`);
    }
    batchCaptures.add(item.clientCaptureId);

    const existing =
      server.find((e) => e.clientCaptureId === item.clientCaptureId) ?? server.find((e) => e.contentHash === item.contentHash);
    if (existing) {
      result.duplicates.push({
        clientCaptureId: item.clientCaptureId,
        reason: existing.clientCaptureId === item.clientCaptureId ? 'SAME_CAPTURE' : 'SAME_CONTENT_HASH',
        existingClientCaptureId: existing.clientCaptureId,
        existingSlot: existing.slot,
      });
      outcomes[index] = { clientCaptureId: item.clientCaptureId, zone: existing.zone, slot: existing.slot, outcome: 'DUPLICATE', assignedByServer: false };
      return;
    }

    const twin = batchHashes.get(item.contentHash);
    if (twin !== undefined) {
      result.duplicates.push({
        clientCaptureId: item.clientCaptureId,
        reason: 'SAME_CONTENT_HASH',
        existingClientCaptureId: twin.clientCaptureId,
      });
      // El slot del gemelo se completa al final (puede ser automatico).
      outcomes[index] = { clientCaptureId: item.clientCaptureId, zone: twin.zone, slot: twin.slot ?? 0, outcome: 'DUPLICATE', assignedByServer: false };
      return;
    }
    batchHashes.set(item.contentHash, { clientCaptureId: item.clientCaptureId, zone: item.zone, slot: item.slot });

    if (item.slot === undefined) {
      pendingAuto.push({ item, index });
      return;
    }
    const slotKey = `${item.zone}#${item.slot}`;
    if (batchSlots.has(slotKey)) {
      throw new SyncPayloadInvalidError(`Dos tomas distintas del mismo dispositivo ocupan ${slotKey}.`);
    }
    batchSlots.set(slotKey, item.contentHash);
    place(item, item.slot, index, false);
  });

  // Tomas sin slot: siguiente libre de la zona, despues de reservar los slots pedidos explicitamente.
  const maxByZone = new Map<string, number>();
  const bump = (zone: string, slot: number): void => {
    if (slot > (maxByZone.get(zone) ?? 0)) maxByZone.set(zone, slot);
  };
  server.forEach((e) => bump(e.zone, e.slot));
  incoming.forEach((i) => {
    if (i.slot !== undefined) bump(i.zone, i.slot);
  });
  for (const { item, index } of pendingAuto) {
    const slot = (maxByZone.get(item.zone) ?? 0) + 1;
    bump(item.zone, slot);
    place(item, slot, index, true);
    const twin = batchHashes.get(item.contentHash);
    if (twin) twin.slot = slot;
  }

  // Duplicados dentro del lote: adoptan el slot (ya definitivo) de su gemelo.
  incoming.forEach((item, index) => {
    const out = outcomes[index];
    if (out && out.outcome === 'DUPLICATE' && out.slot === 0) {
      const twin = batchHashes.get(item.contentHash);
      out.slot = twin?.slot ?? 0;
    }
  });
  for (const dup of result.duplicates) {
    if (dup.existingSlot === undefined) {
      const placed = toAddByCapture.get(dup.existingClientCaptureId);
      if (placed) dup.existingSlot = placed.slot;
    }
  }
  result.assignments = outcomes.filter((o): o is EvidenceSlotAssignment => o !== undefined);
  return result;
}
