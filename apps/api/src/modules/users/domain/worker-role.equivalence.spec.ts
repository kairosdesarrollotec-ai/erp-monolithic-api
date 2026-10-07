import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';
const __dirname = join(fileURLToPath(import.meta.url), '..');
import { WORKER_ROLES } from './worker-role';

/**
 * Hallazgo medio de revision PR#5 ("duplicacion manual del enum"): el rol
 * se replica a mano en 3 lugares (Prisma, dominio, OpenAPI) sin ninguna
 * verificacion automatizada de que sigan iguales. Esta prueba parsea los
 * otros dos archivos como texto (no requiere el cliente Prisma generado,
 * que en este entorno sigue siendo un stub - ver PROP-003 en
 * docs/decision-log.md) y falla si alguno se desalinea del dominio.
 */
describe('WorkerRole - equivalencia entre Prisma, dominio y OpenAPI', () => {
  const domainRoles = [...WORKER_ROLES].sort();

  it('el enum WorkerRole de schema.prisma tiene exactamente los mismos valores que el dominio', () => {
    const schemaPath = join(__dirname, '../../../../prisma/schema.prisma');
    const schema = readFileSync(schemaPath, 'utf8');
    const match = schema.match(/enum WorkerRole \{([^}]*)\}/);
    expect(match).not.toBeNull();
    const prismaRoles = match![1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .sort();

    expect(prismaRoles).toEqual(domainRoles);
  });

  it('transversal.yaml ya no declara un enum cerrado WorkerRole: el rol es RoleRef {id,name,key} (roles dinamicos)', () => {
    const openapiPath = join(
      __dirname,
      '../../../../../../packages/contracts/openapi/transversal.yaml',
    );
    const openapi = readFileSync(openapiPath, 'utf8');
    expect(openapi).not.toMatch(/^\s{4}WorkerRole:/m);
    const roleRefStart = openapi.indexOf('RoleRef:');
    expect(roleRefStart).toBeGreaterThan(-1);
    expect(openapi.slice(roleRefStart, roleRefStart + 600)).toMatch(/required: \[id, name, key\]/);
  });
});
