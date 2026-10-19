import {
  assertMergeAllowed,
  assertResolutionInput,
  canMerge,
  resolveEvidenceConflict,
  resolveFieldConflict,
} from './sync-conflict-resolution';
import { assertSyncedForClosure, deriveChecklistStatus } from './sync-closure-gate';
import {
  SyncConfirmationRequiredError,
  SyncConflictPendingError,
  SyncMergeNotAllowedError,
  SyncReasonRequiredError,
} from './sync-errors';
import type { SyncEvidenceEntry, SyncServerField } from './sync-types';

const NOW = '2026-10-19T15:00:00.000Z';
const serverField: SyncServerField = { value: 'HALF', rev: 4, updatedBy: 'uid-a', updatedAt: '2026-10-19T13:00:00.000Z' };
const ev = (id: string, role: SyncEvidenceEntry['role'], hash: string): SyncEvidenceEntry => ({
  clientCaptureId: id,
  zone: 'INTERIOR',
  slot: 1,
  type: 'PHOTO',
  contentHash: hash,
  sizeBytes: null,
  capturedBy: 'uid',
  capturedAt: NOW,
  deviceId: null,
  role,
});

describe('resolucion de conflictos', () => {
  describe('assertResolutionInput', () => {
    it('exige confirmacion explicita (confirmed=true), nunca implicita', () => {
      expect(() => assertResolutionInput({ resolution: 'KEEP_LOCAL', reason: 'Valide el dato en sitio', confirmed: false })).toThrow(SyncConfirmationRequiredError);
      expect(() => assertResolutionInput({ resolution: 'KEEP_LOCAL', reason: 'Valide el dato en sitio', confirmed: undefined })).toThrow(SyncConfirmationRequiredError);
    });
    it('exige reason (10-500 caracteres tras recortar)', () => {
      expect(() => assertResolutionInput({ resolution: 'KEEP_SERVER', reason: '   corto  ', confirmed: true })).toThrow(SyncReasonRequiredError);
      expect(() => assertResolutionInput({ resolution: 'KEEP_SERVER', reason: undefined, confirmed: true })).toThrow(SyncReasonRequiredError);
      expect(() => assertResolutionInput({ resolution: 'KEEP_SERVER', reason: 'x'.repeat(501), confirmed: true })).toThrow(SyncReasonRequiredError);
      expect(assertResolutionInput({ resolution: 'KEEP_SERVER', reason: '  Conservo lo del servidor.  ', confirmed: true })).toBe('Conservo lo del servidor.');
    });
  });

  describe('combinar solo si no chocan', () => {
    it('un campo en conflicto siempre choca: MERGE rechazado', () => {
      expect(() => assertMergeAllowed('FIELD', 'MERGE')).toThrow(SyncMergeNotAllowedError);
      expect(canMerge('FIELD')).toBe(false);
    });
    it('las evidencias son aditivas: MERGE permitido', () => {
      expect(() => assertMergeAllowed('EVIDENCE', 'MERGE')).not.toThrow();
      expect(canMerge('EVIDENCE')).toBe(true);
    });
  });

  describe('resolveFieldConflict', () => {
    it('KEEP_LOCAL escribe el valor local con una revision NUEVA', () => {
      const r = resolveFieldConflict(serverField, 'FULL', 'KEEP_LOCAL', 'uid-sup', NOW);
      expect(r).toEqual({ value: 'FULL', rev: 5, updatedBy: 'uid-sup', updatedAt: NOW });
    });
    it('KEEP_SERVER no cambia nada', () => {
      expect(resolveFieldConflict(serverField, 'FULL', 'KEEP_SERVER', 'uid-sup', NOW)).toBe(serverField);
    });
    it('MERGE sobre un campo lanza', () => {
      expect(() => resolveFieldConflict(serverField, 'FULL', 'MERGE', 'uid-sup', NOW)).toThrow(SyncMergeNotAllowedError);
    });
  });

  describe('resolveEvidenceConflict: nunca se borra una toma', () => {
    const base = [ev('cap-s', 'PRIMARY', 'h1')];
    const local = ev('cap-l', 'PRIMARY', 'h2');
    const roles = (list: SyncEvidenceEntry[]) => list.map((e) => `${e.clientCaptureId}:${e.role}`).sort();

    it('KEEP_LOCAL: la local pasa a PRIMARY y la del servidor se ARCHIVA', () => {
      expect(roles(resolveEvidenceConflict(base, local, 'KEEP_LOCAL'))).toEqual(['cap-l:PRIMARY', 'cap-s:ARCHIVED']);
    });
    it('KEEP_SERVER: la local se conserva ARCHIVED (auditable)', () => {
      expect(roles(resolveEvidenceConflict(base, local, 'KEEP_SERVER'))).toEqual(['cap-l:ARCHIVED', 'cap-s:PRIMARY']);
    });
    it('MERGE: ambas se conservan, la local como ANNEX', () => {
      expect(roles(resolveEvidenceConflict(base, local, 'MERGE'))).toEqual(['cap-l:ANNEX', 'cap-s:PRIMARY']);
    });
    it('siempre conserva el mismo numero de tomas + la local', () => {
      for (const r of ['KEEP_LOCAL', 'KEEP_SERVER', 'MERGE'] as const) {
        expect(resolveEvidenceConflict(base, local, r)).toHaveLength(2);
      }
    });
  });
});

describe('cierre bloqueado hasta SYNCED confirmado por el servidor', () => {
  it('deriveChecklistStatus: SYNC_CONFLICT con conflictos abiertos, SYNCED sin ellos', () => {
    expect(deriveChecklistStatus(2)).toBe('SYNC_CONFLICT');
    expect(deriveChecklistStatus(0)).toBe('SYNCED');
  });
  it('bloquea con SYNC_CONFLICT_PENDING si hay conflictos abiertos', () => {
    expect(() => assertSyncedForClosure('RECEPCION', { openConflicts: 1 })).toThrow(SyncConflictPendingError);
  });
  it('permite el cierre sin estado offline o con 0 abiertos', () => {
    expect(() => assertSyncedForClosure('ENTREGA', null)).not.toThrow();
    expect(() => assertSyncedForClosure('ENTREGA', { openConflicts: 0 })).not.toThrow();
  });
});
