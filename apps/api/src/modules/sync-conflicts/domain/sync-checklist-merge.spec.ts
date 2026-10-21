import { mergeChecklistFields } from './sync-checklist-merge';
import { SyncPayloadInvalidError } from './sync-errors';
import type { SyncServerField } from './sync-types';

const server = (value: SyncServerField['value'], rev: number, by = 'uid-server'): SyncServerField => ({
  value,
  rev,
  updatedBy: by,
  updatedAt: '2026-10-19T13:00:00.000Z',
});
const local = (key: string, value: SyncServerField['value'], baseRev: number) => ({ key, value, baseRev, editedAt: '2026-10-19T14:00:00.000Z' });

describe('mergeChecklistFields', () => {
  it('campos distintos se combinan: el servidor cambio A y el dispositivo cambio B', () => {
    const r = mergeChecklistFields({ mileage: server(1200, 2) }, [local('fuel', 'FULL', 0)]);
    expect(r.toApply).toEqual([{ key: 'fuel', value: 'FULL' }]);
    expect(r.clashes).toEqual([]);
  });

  it('el servidor no avanzo desde la revision base: se aplica el valor del dispositivo', () => {
    const r = mergeChecklistFields({ fuel: server('HALF', 3) }, [local('fuel', 'FULL', 3)]);
    expect(r.toApply).toEqual([{ key: 'fuel', value: 'FULL' }]);
  });

  it('mismo campo modificado por dos actores con valores distintos: CHOQUE (nunca gana el ultimo)', () => {
    const r = mergeChecklistFields({ fuel: server('HALF', 4) }, [local('fuel', 'FULL', 3)]);
    expect(r.toApply).toEqual([]);
    expect(r.clashes).toHaveLength(1);
    expect(r.clashes[0].server.value).toBe('HALF');
    expect(r.clashes[0].local.value).toBe('FULL');
  });

  it('mismo valor en ambos lados converge sin conflicto', () => {
    const r = mergeChecklistFields({ fuel: server('FULL', 4) }, [local('fuel', 'FULL', 3)]);
    expect(r.unchanged).toEqual(['fuel']);
    expect(r.clashes).toEqual([]);
    expect(r.toApply).toEqual([]);
  });

  it('mezcla: un campo choca y otro se combina en la misma sincronizacion', () => {
    const r = mergeChecklistFields({ fuel: server('HALF', 2) }, [local('fuel', 'FULL', 1), local('mileage', 900, 0)]);
    expect(r.clashes.map((c) => c.key)).toEqual(['fuel']);
    expect(r.toApply.map((c) => c.key)).toEqual(['mileage']);
  });

  it('rechaza claves repetidas y revisiones base imposibles', () => {
    expect(() => mergeChecklistFields({}, [local('a', 1, 0), local('a', 2, 0)])).toThrow(SyncPayloadInvalidError);
    expect(() => mergeChecklistFields({ a: server(1, 1) }, [local('a', 2, 5)])).toThrow(SyncPayloadInvalidError);
  });
});
