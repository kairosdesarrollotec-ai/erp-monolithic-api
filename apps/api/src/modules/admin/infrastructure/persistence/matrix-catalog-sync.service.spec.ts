import { MatrixCatalogSyncService, MATRIX_CATALOG_SYNC_ACTOR } from './matrix-catalog-sync.service';
import { PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { WORKER_ROLES } from '../../../users/domain/worker-role';

function build(rows: { roleId: string; action: string }[] | null) {
  const prisma = {
    role: {
      findMany: jest.fn().mockImplementation(async (args: { distinct?: string[] }) =>
        args.distinct ? [{ organizationId: 'org-1' }] : WORKER_ROLES.map((key) => ({ id: `role-${key}`, key })),
      ),
    },
    rolePermissionMatrixVersion: {
      aggregate: jest.fn().mockResolvedValue({ _max: { version: rows === null ? null : 3 } }),
      findMany: jest.fn().mockResolvedValue(rows ?? []),
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
    },
  };
  return { prisma, service: new MatrixCatalogSyncService(prisma as never) };
}

const fullSnapshotWithout = (skip: string[]) =>
  WORKER_ROLES.flatMap((key) =>
    PERMISSION_ACTION_CATALOG.map((d) => ({ roleId: `role-${key}`, action: `${d.module}.${d.action}` })).filter((r) => !skip.includes(r.action)),
  );

describe('MatrixCatalogSyncService', () => {
  it('sin matriz guardada (v0 implicita) no inserta nada', async () => {
    const { prisma, service } = build(null);
    await expect(service.syncAll()).resolves.toEqual({ organizations: 1, inserted: 0 });
    expect(prisma.rolePermissionMatrixVersion.createMany).not.toHaveBeenCalled();
  });

  it('siembra en la version vigente de la capa de organizacion, sin subir la version, con skipDuplicates', async () => {
    const { prisma, service } = build(fullSnapshotWithout(['NOTIFICATIONS.RECEIVE_RETURN_ALERTS']));
    const result = await service.syncAll();
    expect(result.inserted).toBe(WORKER_ROLES.length);
    const arg = prisma.rolePermissionMatrixVersion.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data.every((d: { version: number; companyId: null; branchId: null; createdBy: string }) =>
      d.version === 3 && d.companyId === null && d.branchId === null && d.createdBy === MATRIX_CATALOG_SYNC_ACTOR)).toBe(true);
    const gerencia = arg.data.find((d: { roleId: string }) => d.roleId === 'role-GERENCIA');
    expect(gerencia).toMatchObject({ action: 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS', allowed: true });
    expect(arg.data.find((d: { roleId: string }) => d.roleId === 'role-CAMPO').allowed).toBe(false);
  });

  it('matriz completa: no escribe (idempotente)', async () => {
    const { prisma, service } = build(fullSnapshotWithout([]));
    await expect(service.syncAll()).resolves.toEqual({ organizations: 1, inserted: 0 });
    expect(prisma.rolePermissionMatrixVersion.createMany).not.toHaveBeenCalled();
  });
});
