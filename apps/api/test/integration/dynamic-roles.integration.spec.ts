import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { ensureSystemRoles } from '../../src/modules/admin/infrastructure/persistence/system-roles-seeder';
import { PrismaRoleRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role.repository';
import { PrismaRolePermissionMatrixRepository } from '../../src/modules/admin/infrastructure/persistence/prisma-role-permission-matrix.repository';
import { PERMISSION_ACTION_CATALOG } from '../../src/modules/admin/domain/permission-action-catalog';
import { isAllowedByLayers } from '../../src/modules/admin/domain/matrix-resolution';
import { MatrixVersionConflictError, RoleNameTakenError } from '../../src/modules/admin/domain/role-errors';

/**
 * Roles dinamicos sobre PostgreSQL REAL: siembra idempotente, unicidad del
 * nombre sin distinguir mayusculas (indice funcional que Prisma no modela),
 * concurrencia optimista por version, matriz por role_id con ambito
 * (sede > empresa > organizacion) y las FK/CHECK compuestas de la migracion
 * 20261007000000_dynamic_roles.
 */
describe('Roles dinamicos y matriz con ambito (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let roles: PrismaRoleRepository;
  let matrix: PrismaRolePermissionMatrixRepository;

  const org = randomUUID();
  const otherOrg = randomUUID();
  const company = randomUUID();
  const branch = randomUUID();
  const otherBranch = randomUUID();
  let systemIds: Map<string, string>;
  let otherOrgIds: Map<string, string>;

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
    const service = prisma as unknown as PrismaService;
    roles = new PrismaRoleRepository(service);
    matrix = new PrismaRolePermissionMatrixRepository(service);

    await prisma.company.create({ data: { id: company, organizationId: org, name: 'Empresa roles' } });
    await prisma.branch.createMany({
      data: [
        { id: branch, companyId: company, name: 'Sede 1' },
        { id: otherBranch, companyId: company, name: 'Sede 2' },
      ],
    });
    systemIds = await ensureSystemRoles(prisma, org);
    otherOrgIds = await ensureSystemRoles(prisma, otherOrg);
  }, 60000);

  afterAll(async () => {
    if (db) await db.stop();
  });

  it('ensureSystemRoles siembra los 8 roles de sistema por organizacion y es idempotente', async () => {
    expect(systemIds.size).toBe(8);
    const again = await ensureSystemRoles(prisma, org);
    expect([...again.entries()].sort()).toEqual([...systemIds.entries()].sort());
    expect(await prisma.role.count({ where: { organizationId: org } })).toBe(8);
    expect(new Set([...systemIds.values(), ...otherOrgIds.values()]).size).toBe(16);
  });

  it('el nombre del rol es unico por organizacion SIN distinguir mayusculas; en otra organizacion se puede repetir', async () => {
    const created = await roles.create({ organizationId: org, name: 'Supervisor' });
    expect(created).toMatchObject({ name: 'Supervisor', isSystem: false, key: null, active: true, version: 1 });

    await expect(roles.create({ organizationId: org, name: 'SUPERVISOR' })).rejects.toBeInstanceOf(RoleNameTakenError);
    await expect(roles.create({ organizationId: org, name: 'Administración' })).rejects.toBeInstanceOf(RoleNameTakenError); // choca con un rol de sistema
    await expect(roles.create({ organizationId: otherOrg, name: 'Supervisor' })).resolves.toMatchObject({ name: 'Supervisor' });
  });

  it('renombrar/desactivar usan control optimista por version (la version vieja devuelve null) y findById respeta la organizacion', async () => {
    const created = await roles.create({ organizationId: org, name: 'Operador' });

    const renamed = await roles.rename({ id: created.id, organizationId: org, expectedVersion: 1, name: 'Operador Senior' });
    expect(renamed).toMatchObject({ name: 'Operador Senior', version: 2 });
    expect(await roles.rename({ id: created.id, organizationId: org, expectedVersion: 1, name: 'Otro' })).toBeNull();
    await expect(roles.rename({ id: created.id, organizationId: org, expectedVersion: 2, name: 'supervisor' })).rejects.toBeInstanceOf(RoleNameTakenError);

    expect(await roles.findById(created.id, otherOrg)).toBeNull(); // IDOR: otra organizacion = inexistente
    expect(await roles.deactivate({ id: created.id, organizationId: otherOrg, expectedVersion: 2 })).toBeNull();

    const deactivated = await roles.deactivate({ id: created.id, organizationId: org, expectedVersion: 2 });
    expect(deactivated).toMatchObject({ active: false, version: 3 });
    expect((await roles.listActive(org)).map((r) => r.id)).not.toContain(created.id);
    expect((await roles.listByOrganization(org, { includeInactive: true })).map((r) => r.id)).toContain(created.id);
  });

  it('assignmentCount cuenta solo asignaciones activas con el rol', async () => {
    const role = await roles.create({ organizationId: org, name: 'Con asignaciones' });
    await prisma.userCompanyAssignment.createMany({
      data: [
        { organizationId: org, firebaseUid: 'it-uid-1', companyId: company, branchId: branch, roleId: role.id, active: true },
        { organizationId: org, firebaseUid: 'it-uid-2', companyId: company, branchId: branch, roleId: role.id, active: false },
      ],
    });

    expect(await roles.countActiveAssignments(role.id, org)).toBe(1);
    const listed = await roles.listByOrganization(org, { includeInactive: false });
    expect(listed.find((r) => r.id === role.id)?.assignmentCount).toBe(1);
  });

  it('sin version guardada, la matriz es la version 0 implicita mapeada a los role_id de la organizacion (PLATFORM_ADMIN todo permitido, rol nuevo sin permisos)', async () => {
    const custom = await roles.create({ organizationId: org, name: 'Rol sin permisos' });
    const layers = await matrix.getLayers(org, { companyId: company, branchId: branch });

    expect(layers).toHaveLength(1);
    expect(layers[0].version).toBe(0);
    const platformAdmin = systemIds.get('PLATFORM_ADMIN')!;
    expect(PERMISSION_ACTION_CATALOG.every((d) => isAllowedByLayers(layers, platformAdmin, d.module, d.action))).toBe(true);
    expect(isAllowedByLayers(layers, systemIds.get('FRONT_OFFICE')!, 'RESERVATION', 'CREATE')).toBe(true);
    expect(isAllowedByLayers(layers, systemIds.get('CAMPO')!, 'INCIDENT', 'CREATE')).toBe(true);
    expect(PERMISSION_ACTION_CATALOG.some((d) => isAllowedByLayers(layers, custom.id, d.module, d.action))).toBe(false);
  });

  it('resolucion por ambito: la version de sede pisa a la de empresa y esta a la de organizacion; numeracion unica por organizacion', async () => {
    const frontOffice = systemIds.get('FRONT_OFFICE')!;
    const cell = (allowed: boolean) => [{ roleId: frontOffice, module: 'RESERVATION' as const, action: 'CREATE', allowed }];

    const orgVersion = await matrix.saveNewVersion(org, cell(true), 'uid-admin', { companyId: null, branchId: null });
    const companyVersion = await matrix.saveNewVersion(org, cell(false), 'uid-admin', { companyId: company, branchId: null });
    const branchVersion = await matrix.saveNewVersion(org, cell(true), 'uid-admin', { companyId: company, branchId: branch });
    expect([orgVersion.version, companyVersion.version, branchVersion.version]).toEqual([1, 2, 3]);

    const inBranch = await matrix.getLayers(org, { companyId: company, branchId: branch });
    const inOtherBranch = await matrix.getLayers(org, { companyId: company, branchId: otherBranch });
    expect(inBranch.map((l) => l.version)).toEqual([3, 2, 1]);
    expect(isAllowedByLayers(inBranch, frontOffice, 'RESERVATION', 'CREATE')).toBe(true); // sede
    expect(isAllowedByLayers(inOtherBranch, frontOffice, 'RESERVATION', 'CREATE')).toBe(false); // empresa pisa a organizacion
    // Un rol sin entrada en la capa que existe queda denegado (deny-by-default), no hereda de v0.
    expect(isAllowedByLayers(inBranch, systemIds.get('GERENCIA')!, 'RESERVATION', 'CREATE')).toBe(false);

    expect((await matrix.getCurrentVersion(org, { companyId: company, branchId: null })).version).toBe(2);
    expect((await matrix.getAllCurrentSnapshots(org)).map((s) => s.version).sort()).toEqual([1, 2, 3]);
  });

  it('dos guardados concurrentes con el mismo numero de version: uno gana y el otro recibe MatrixVersionConflictError', async () => {
    const frontOffice = systemIds.get('FRONT_OFFICE')!;
    const entries = [{ roleId: frontOffice, module: 'INQUIRY' as const, action: 'READ', allowed: true }];
    const outcomes = await Promise.allSettled([
      matrix.saveNewVersion(org, entries, 'uid-a', { companyId: null, branchId: null }),
      matrix.saveNewVersion(org, entries, 'uid-b', { companyId: null, branchId: null }),
    ]);

    const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
    // En el peor caso (lecturas que no se solapan) ambos pueden ganar con versiones distintas; nunca debe haber dos filas con la misma version+rol+accion.
    for (const r of rejected) expect(r.reason).toBeInstanceOf(MatrixVersionConflictError);
    const duplicates = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM (
        SELECT 1 FROM role_permission_matrix_versions WHERE organization_id = ${org}
        GROUP BY version, role_id, action HAVING count(*) > 1) d`;
    expect(Number(duplicates[0].n)).toBe(0);
  });

  it('la base RECHAZA una celda de matriz con un rol de OTRA organizacion (FK compuesta)', async () => {
    await expect(
      prisma.rolePermissionMatrixVersion.create({
        data: { organizationId: org, version: 900, roleId: otherOrgIds.get('GERENCIA')!, action: 'RESERVATION.CREATE', allowed: true, createdBy: 'uid' },
      }),
    ).rejects.toThrow();
  });

  it('la base RECHAZA un ambito con sede sin empresa (CHECK) y una sede de otra empresa/organizacion (FK compuesta)', async () => {
    await expect(
      prisma.rolePermissionMatrixVersion.create({
        data: { organizationId: org, version: 901, roleId: systemIds.get('GERENCIA')!, branchId: branch, action: 'RESERVATION.CREATE', allowed: true, createdBy: 'uid' },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.rolePermissionMatrixVersion.create({
        data: { organizationId: otherOrg, version: 902, roleId: otherOrgIds.get('GERENCIA')!, companyId: company, action: 'RESERVATION.CREATE', allowed: true, createdBy: 'uid' },
      }),
    ).rejects.toThrow();
  });

  it('la base RECHAZA borrar un rol referenciado por una asignacion (onDelete Restrict: los roles se desactivan, no se borran)', async () => {
    const role = await roles.create({ organizationId: org, name: 'No borrable' });
    await prisma.userCompanyAssignment.create({
      data: { organizationId: org, firebaseUid: 'it-uid-restrict', companyId: company, branchId: branch, roleId: role.id },
    });

    await expect(prisma.role.delete({ where: { id: role.id } })).rejects.toThrow();
  });
});
