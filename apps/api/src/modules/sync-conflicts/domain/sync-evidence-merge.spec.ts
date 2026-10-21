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
    expect(r.duplicates).toEqual([{ clientCaptureId: 'cap-l1', reason: 'SAME_CONTENT_HASH', existingClientCaptureId: 'cap-s1', existingSlot: 1 }]);
    expect(r.assignments).toEqual([{ clientCaptureId: 'cap-l1', zone: 'INTERIOR', slot: 1, outcome: 'DUPLICATE', assignedByServer: false }]);
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

  describe('asignacion de slot por el servidor (1.1.0, DEC-SYNC-11)', () => {
    const noSlot = (over: Partial<IncomingEvidence> = {}): IncomingEvidence => {
      const { slot: _slot, ...rest } = incoming(over);
      return rest;
    };

    it('sin slot: asigna el siguiente libre de la zona, sin conflicto aunque el slot 1 este ocupado por otro hash', () => {
      const r = mergeEvidence([server()], [noSlot({ contentHash: H2 })]);
      expect(r.clashes).toEqual([]);
      expect(r.toAdd).toHaveLength(1);
      expect(r.toAdd[0].slot).toBe(2);
      expect(r.assignments).toEqual([{ clientCaptureId: 'cap-l1', zone: 'INTERIOR', slot: 2, outcome: 'ADDED', assignedByServer: true }]);
    });

    it('sin slot: varias tomas del lote reciben slots consecutivos y las ARCHIVED tambien cuentan (nunca se reutiliza)', () => {
      const r = mergeEvidence(
        [server({ slot: 3, role: 'ARCHIVED' })],
        [noSlot({ clientCaptureId: 'a', contentHash: H2 }), noSlot({ clientCaptureId: 'b', contentHash: H3 }), noSlot({ clientCaptureId: 'c', zone: 'EXTERIOR', contentHash: 'd'.repeat(64) })],
      );
      expect(r.toAdd.map((e) => `${e.zone}#${e.slot}`)).toEqual(['INTERIOR#4', 'INTERIOR#5', 'EXTERIOR#1']);
    });

    it('sin slot no choca con un slot pedido explicitamente en el mismo lote', () => {
      const r = mergeEvidence([], [noSlot({ clientCaptureId: 'a', contentHash: H2 }), incoming({ clientCaptureId: 'b', slot: 1, contentHash: H3 })]);
      expect(r.clashes).toEqual([]);
      expect(r.toAdd.find((e) => e.clientCaptureId === 'b')?.slot).toBe(1);
      expect(r.toAdd.find((e) => e.clientCaptureId === 'a')?.slot).toBe(2);
    });

    it('mismo hash ya registrado: idempotente con el slot EXISTENTE aunque pida otro o no envie slot (no hay conflicto)', () => {
      const withSlot = mergeEvidence([server()], [incoming({ contentHash: H1, slot: 1 })]);
      expect(withSlot.clashes).toEqual([]);
      expect(withSlot.duplicates[0]).toMatchObject({ reason: 'SAME_CONTENT_HASH', existingSlot: 1 });
      const without = mergeEvidence([server()], [noSlot({ contentHash: H1 })]);
      expect(without.assignments[0]).toMatchObject({ slot: 1, outcome: 'DUPLICATE', assignedByServer: false });
    });

    it('reintento (mismo clientCaptureId) sin slot: SAME_CAPTURE con su slot, sin duplicar', () => {
      const r = mergeEvidence([server({ clientCaptureId: 'cap-l1', slot: 7 })], [noSlot({ contentHash: H3 })]);
      expect(r.toAdd).toEqual([]);
      expect(r.duplicates).toEqual([{ clientCaptureId: 'cap-l1', reason: 'SAME_CAPTURE', existingClientCaptureId: 'cap-l1', existingSlot: 7 }]);
    });

    it('gemelo dentro del lote (mismo hash) sin slot: adopta el slot asignado a la primera toma', () => {
      const r = mergeEvidence([], [noSlot({ clientCaptureId: 'a', contentHash: H2 }), noSlot({ clientCaptureId: 'b', contentHash: H2 })]);
      expect(r.toAdd).toHaveLength(1);
      expect(r.assignments.map((a) => [a.clientCaptureId, a.slot, a.outcome])).toEqual([
        ['a', 1, 'ADDED'],
        ['b', 1, 'DUPLICATE'],
      ]);
      expect(r.duplicates[0].existingSlot).toBe(1);
    });

    it('slot pedido ocupado con OTRO hash sigue siendo conflicto (regla de la matriz intacta)', () => {
      const r = mergeEvidence([server()], [incoming({ slot: 1, contentHash: H2 })]);
      expect(r.clashes).toHaveLength(1);
      expect(r.assignments[0]).toMatchObject({ outcome: 'CONFLICT', slot: 1, assignedByServer: false });
    });
  });
});
