import { SyncPayloadInvalidError } from './sync-errors';
import type { SyncEvidenceEntry } from './sync-types';

export type IncomingEvidence = Omit<SyncEvidenceEntry, 'role' | 'capturedBy'>;

export interface EvidenceDuplicate {
  clientCaptureId: string;
  reason: 'SAME_CAPTURE' | 'SAME_CONTENT_HASH';
  existingClientCaptureId: string;
}

export interface EvidenceClash {
  zone: string;
  slot: number;
  server: SyncEvidenceEntry;
  local: IncomingEvidence;
}

export interface EvidenceMergeResult {
  /** Tomas en un slot libre: se agregan (evidencia ADITIVA). */
  toAdd: IncomingEvidence[];
  /** Mismo clientCaptureId o mismo contentHash: idempotente, NO se duplica (SDD 17.3 "archivo duplicado"). */
  duplicates: EvidenceDuplicate[];
  /** Slot ocupado con otro contentHash: nunca se sobrescribe en silencio -> conflicto. */
  clashes: EvidenceClash[];
}

/**
 * Evidencias aditivas (SDD 17.4) + archivo duplicado se compara por integridad (`contentHash`) y no se duplica
 * (SDD 17.3). Una toma = (zone, slot). Funcion pura.
 */
export function mergeEvidence(
  server: readonly SyncEvidenceEntry[],
  incoming: readonly IncomingEvidence[],
): EvidenceMergeResult {
  const result: EvidenceMergeResult = { toAdd: [], duplicates: [], clashes: [] };
  const batchCaptures = new Set<string>();
  const batchSlots = new Map<string, string>();
  const batchHashes = new Map<string, string>();

  for (const item of incoming) {
    if (batchCaptures.has(item.clientCaptureId)) {
      throw new SyncPayloadInvalidError(`clientCaptureId ${item.clientCaptureId} repetido en la sincronizacion.`);
    }
    batchCaptures.add(item.clientCaptureId);

    const sameCapture = server.find((e) => e.clientCaptureId === item.clientCaptureId);
    if (sameCapture) {
      result.duplicates.push({
        clientCaptureId: item.clientCaptureId,
        reason: 'SAME_CAPTURE',
        existingClientCaptureId: sameCapture.clientCaptureId,
      });
      continue;
    }
    const sameHash = server.find((e) => e.contentHash === item.contentHash);
    if (sameHash) {
      result.duplicates.push({
        clientCaptureId: item.clientCaptureId,
        reason: 'SAME_CONTENT_HASH',
        existingClientCaptureId: sameHash.clientCaptureId,
      });
      continue;
    }

    const batchTwin = batchHashes.get(item.contentHash);
    if (batchTwin !== undefined) {
      result.duplicates.push({
        clientCaptureId: item.clientCaptureId,
        reason: 'SAME_CONTENT_HASH',
        existingClientCaptureId: batchTwin,
      });
      continue;
    }
    const slotKey = `${item.zone}#${item.slot}`;
    if (batchSlots.has(slotKey)) {
      throw new SyncPayloadInvalidError(`Dos tomas distintas del mismo dispositivo ocupan ${slotKey}.`);
    }
    batchSlots.set(slotKey, item.contentHash);
    batchHashes.set(item.contentHash, item.clientCaptureId);

    const occupant = server.find((e) => e.zone === item.zone && e.slot === item.slot && e.role === 'PRIMARY');
    if (occupant) {
      result.clashes.push({ zone: item.zone, slot: item.slot, server: occupant, local: item });
    } else {
      result.toAdd.push(item);
    }
  }
  return result;
}
