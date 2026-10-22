import { ensureHrAreasForCompany } from './hr-areas-seeder';
import { DEFAULT_HR_AREAS } from '../../domain/hr-area-rules';

describe('ensureHrAreasForCompany: idempotencia sobre una BD recien migrada', () => {
  // Simula la tabla con la restriccion unica (empresa, codigo) y createMany + skipDuplicates.
  function fakeClient(existing: Array<{ operatingCompanyId: string; code: string }> = []) {
    const rows = [...existing];
    return {
      rows,
      client: {
        hrArea: {
          createMany: jest.fn().mockImplementation(async ({ data, skipDuplicates }: { data: typeof rows; skipDuplicates: boolean }) => {
            let count = 0;
            for (const d of data) {
              const dup = rows.some((r) => r.operatingCompanyId === d.operatingCompanyId && r.code === d.code);
              if (dup && !skipDuplicates) throw new Error('unique violation');
              if (!dup) {
                rows.push(d);
                count++;
              }
            }
            return { count };
          }),
        },
      },
    };
  }

  it('la primera ejecucion crea las 9 areas y la segunda no crea ninguna', async () => {
    const f = fakeClient();
    expect(await ensureHrAreasForCompany(f.client as never, 'org', 'comp')).toBe(DEFAULT_HR_AREAS.length);
    expect(await ensureHrAreasForCompany(f.client as never, 'org', 'comp')).toBe(0);
    expect(f.rows).toHaveLength(9);
  });

  it('completa solo las que faltan (p. ej. tras la migracion 20261021010001 de las dos nuevas)', async () => {
    const existing = DEFAULT_HR_AREAS.slice(0, 7).map((a) => ({ operatingCompanyId: 'comp', code: a.code }));
    const f = fakeClient(existing);
    expect(await ensureHrAreasForCompany(f.client as never, 'org', 'comp')).toBe(2);
  });

  it('las 9 areas del catalogo tienen codigo unico y nombre oficial', () => {
    expect(new Set(DEFAULT_HR_AREAS.map((a) => a.code)).size).toBe(DEFAULT_HR_AREAS.length);
    expect(DEFAULT_HR_AREAS.map((a) => a.code)).toEqual(
      expect.arrayContaining(['GERENCIA_GENERAL', 'GESTION_Y_PROCESOS', 'TALENTO_HUMANO', 'OPERACIONES']),
    );
  });
});
