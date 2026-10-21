import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { areaCodeFromText, normalizeAreaText } from './hr-area-rules';

const here = dirname(fileURLToPath(import.meta.url));

describe('hr-area-rules (H-02)', () => {
  it('normaliza mayusculas, tildes y espacios', () => {
    expect(normalizeAreaText('  Atención   al CLIENTE ')).toBe('ATENCION AL CLIENTE');
    expect(normalizeAreaText('Desarrollo de Tecnología')).toBe('DESARROLLO DE TECNOLOGIA');
    expect(normalizeAreaText('Niño-Ñandú')).toBe('NINO NANDU');
  });

  it('deriva el mismo codigo del texto libre y del codigo canonico (idempotente)', () => {
    expect(areaCodeFromText('Atención al cliente')).toBe('ATENCION_AL_CLIENTE');
    expect(areaCodeFromText('ATENCION_AL_CLIENTE')).toBe('ATENCION_AL_CLIENTE');
    expect(areaCodeFromText(' operaciones ')).toBe('OPERACIONES');
    expect(areaCodeFromText('Administración y Finanzas')).toBe('ADMINISTRACION_Y_FINANZAS');
  });

  it('la semilla de la migracion usa codigos iguales a areaCodeFromText(nombre) (solo areas documentadas)', () => {
    const sql = readFileSync(
      join(here, '../../../../prisma/migrations/20261019000900_hr_areas_catalog/migration.sql'),
      'utf-8',
    );
    const rows = [...sql.matchAll(/\('([A-Z_]+)', '([^']+)', '[^']*', \d+\)/g)].map((m) => ({ code: m[1], name: m[2] }));
    expect(rows.map((r) => r.code)).toEqual([
      'ADMINISTRACION',
      'TALENTO_HUMANO',
      'SERVICIOS_GENERALES',
      'DESARROLLO_DE_TECNOLOGIA',
      'ATENCION_AL_CLIENTE',
      'MARKETING',
      'OPERACIONES',
    ]);
    for (const r of rows) expect(areaCodeFromText(r.name)).toBe(r.code);
  });
});
