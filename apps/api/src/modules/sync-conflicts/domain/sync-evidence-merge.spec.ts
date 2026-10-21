import { mergeEvidence, type IncomingEvidence } from './sync-evidence-merge';
import { SyncPayloadInvalidError } from './sync-errors';
import type { SyncEvidenceEntry } from './sync-types';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const H3 = 'c'.repeat(64);
const server = (over: Partial<SyncEvidenceEntry> = {}): SyncEvidenceEntry => ({
  clientCaptureId: 'cap-s1',
  zone: 'INTERIOR',
  slot: 1,
  type: 'PHOTO',
  contentHash: H1,
  sizeBytes: 1000,
  capturedBy: 'uid-server',
  capturedAt: '2026-10-19T13:00:00.000Z',
  deviceId: 'dev-s',
  role: 'PRIMARY',
  ...over,
});
const incoming = (over: Partial<IncomingEvidence> = {}): IncomingEvidence => ({
  clientCaptureId: 'cap-l1',
  zone: 'INTERIOR',
  slot: 2,
  type: 'PHOTO',
  contentHash: H2,
  sizeBytes: 900,
  capturedAt: '2026-10-19T14:00:00.000Z',
  deviceId: 'dev-l',
  ...over,
});

describe('mergeEvidence', () => {
  it('evidencia aditiva: un slot libre se agrega sin tocar lo existente', () => {
    const r = mergeEvidence([server()], [incoming()]);
    expect(r.toAdd).toHaveLength(1);
    expect(r.clashes).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it('el mismo contentHash no se duplica (idempotente), aunque venga con otro clientCaptureId o slot', () => {
    const r = mergeEvidence([server()], [incoming({ contentHash: H1, slot: 5 })]);
    expect(r.toAdd).toEqual([]);
    expect(r.duplicates).toEqual([{ clientCaptureId: 'cap-l1', reason: 'SAME_CONTENT_HASH', existingClientCaptureId: 'cap-s1' }]);
  });

  it('el mismo clientCaptureId es un reintento: no duplica', () => {
    const r = mergeEvidence([server()], [incoming({ clientCaptureId: 'cap-s1', contentHash: H3 })]);
    expect(r.duplicates[0].reason).toBe('SAME_CAPTURE');
    expect(r.toAdd).toEqual([]);
  });

  it('slot ocupado con otro hash: conflicto, NUNCA sobrescribe en silencio', () => {
    const r = mergeEvidence([server()], [incoming({ slot: 1 })]);
    expect(r.toAdd).toEqual([]);
    expect(r.clashes).toHaveLength(1);
    expect(r.clashes[0]).toMatchObject({ zone: 'INTERIOR', slot: 1 });
    expect(r.clashes[0].server.contentHash).toBe(H1);
  });

  it('un slot cuyo ocupante esta ARCHIVED cuenta como libre', () => {
    const r = mergeEvidence([server({ role: 'ARCHIVED' })], [incoming({ slot: 1 })]);
    expect(r.toAdd).toHaveLength(1);
  });

  it('dentro del mismo lote: mismo hash = duplicado; dos hashes distintos en un slot = payload invalido', () => {
    const dup = mergeEvidence([], [incoming(), incoming({ clientCaptureId: 'cap-l2', slot: 3 })]);
    expect(dup.toAdd).toHaveLength(1);
    expect(dup.duplicates).toHaveLength(1);
    expect(() => mergeEvidence([], [incoming(), incoming({ clientCaptureId: 'cap-l2', contentHash: H3 })])).toThrow(SyncPayloadInvalidError);
    expect(() => mergeEvidence([], [incoming(), incoming()])).toThrow(SyncPayloadInvalidError);
  });
});
