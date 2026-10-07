import { MatrixAuthorizationService } from './matrix-authorization.service';
import {
  ORGANIZATION_SCOPE,
  RolePermissionEntry,
  RolePermissionMatrixPort,
  RolePermissionMatrixSnapshot,
} from '../admin/application/ports/role-permission-matrix.port';

const FRONT = 'role-front';
const CAMPO = 'role-campo';
const ADMIN_ROLE = 'role-admin';

function layer(
  version: number,
  entries: RolePermissionEntry[],
  scope: RolePermissionMatrixSnapshot['scope'] = ORGANIZATION_SCOPE,
): RolePermissionMatrixSnapshot {
  return { version, scope, entries };
}

function buildMatrix(layers: RolePermissionMatrixSnapshot[]): jest.Mocked<RolePermissionMatrixPort> {
  return {
    getLayers: jest.fn().mockResolvedValue(layers),
    getCurrentVersion: jest.fn(),
    getAllCurrentSnapshots: jest.fn(),
    saveNewVersion: jest.fn(),
  };
}

describe('MatrixAuthorizationService', () => {
  it('permite una accion cuando la matriz vigente tiene una entrada con allowed=true para el roleId', async () => {
    const matrix = buildMatrix([
      layer(1, [
        { roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: true },
        { roleId: FRONT, module: 'INQUIRY', action: 'REGISTER', allowed: true },
        { roleId: ADMIN_ROLE, module: 'ADMIN', action: 'MANAGE_USERS', allowed: true },
      ]),
    ]);
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CREATE')).resolves.toBeUndefined();
    await expect(service.assertAllowed('org-1', FRONT, 'INQUIRY', 'REGISTER')).resolves.toBeUndefined();
    await expect(service.assertAllowed('org-1', ADMIN_ROLE, 'ADMIN', 'MANAGE_USERS')).resolves.toBeUndefined();
    expect(await service.isAllowed('org-1', FRONT, 'RESERVATION', 'CREATE')).toBe(true);
  });

  it('pide a la matriz las capas del contexto y solo las entradas del rol', async () => {
    const matrix = buildMatrix([layer(1, [{ roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: true }])]);
    const service = new MatrixAuthorizationService(matrix);

    await service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CREATE', { companyId: 'c-1', branchId: 'b-1' });

    expect(matrix.getLayers).toHaveBeenCalledWith('org-1', { companyId: 'c-1', branchId: 'b-1' }, { roleId: FRONT });
  });

  it('deniega (403 ROLE_NOT_ALLOWED) para RESERVATION cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix([layer(1, [{ roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: false }])]);
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CREATE')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
    // Entrada inexistente -> deny-by-default
    await expect(service.assertAllowed('org-1', CAMPO, 'RESERVATION', 'CREATE')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
    expect(await service.isAllowed('org-1', FRONT, 'RESERVATION', 'CREATE')).toBe(false);
  });

  it('un rol sin ninguna entrada (rol nuevo) queda denegado en todo, incluso con el nombre PLATFORM_ADMIN (sin atajo)', async () => {
    const matrix = buildMatrix([layer(3, [{ roleId: FRONT, module: 'ADMIN', action: 'MANAGE_PERMISSIONS', allowed: true }])]);
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', 'role-recien-creado', 'ADMIN', 'MANAGE_PERMISSIONS')).rejects.toMatchObject({
      response: { code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX' },
    });
    await expect(service.assertAllowed('org-1', 'role-PLATFORM_ADMIN', 'INCIDENT', 'VIEW')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
  });

  it('deniega (403 ROLE_NOT_ALLOWED) para INQUIRY cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix([layer(2, [{ roleId: CAMPO, module: 'INQUIRY', action: 'READ', allowed: false }])]);
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', CAMPO, 'INQUIRY', 'READ')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
    await expect(service.assertAllowed('org-1', CAMPO, 'INQUIRY', 'REGISTER')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
  });

  it('deniega (403 ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX) para ADMIN cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix([layer(1, [{ roleId: FRONT, module: 'ADMIN', action: 'MANAGE_USERS', allowed: false }])]);
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', FRONT, 'ADMIN', 'MANAGE_USERS')).rejects.toMatchObject({
      response: { code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX' },
    });
  });

  it('no confunde una entrada de otro modulo con el mismo nombre de accion', async () => {
    const matrix = buildMatrix([layer(1, [{ roleId: ADMIN_ROLE, module: 'RESERVATION', action: 'READ', allowed: true }])]);
    const service = new MatrixAuthorizationService(matrix);

    // READ esta permitido para RESERVATION pero no para INQUIRY
    await expect(service.assertAllowed('org-1', ADMIN_ROLE, 'INQUIRY', 'READ')).rejects.toMatchObject({
      response: { code: 'ROLE_NOT_ALLOWED' },
    });
  });

  describe('ambito (sede > empresa > organizacion)', () => {
    const orgLayer = layer(1, [
      { roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: true },
      { roleId: FRONT, module: 'RESERVATION', action: 'CONFIRM', allowed: true },
    ]);

    it('la capa de la sede gana sobre la de empresa y la de organizacion', async () => {
      const branchLayer = layer(
        4,
        [{ roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: false }],
        { companyId: 'c-1', branchId: 'b-1' },
      );
      const companyLayer = layer(
        3,
        [{ roleId: FRONT, module: 'RESERVATION', action: 'CREATE', allowed: true }],
        { companyId: 'c-1', branchId: null },
      );
      const service = new MatrixAuthorizationService(buildMatrix([branchLayer, companyLayer, orgLayer]));

      await expect(
        service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CREATE', { companyId: 'c-1', branchId: 'b-1' }),
      ).rejects.toMatchObject({ response: { code: 'ROLE_NOT_ALLOWED' } });
    });

    it('sin entrada en la capa mas especifica se resuelve en la de arriba (p. ej. un rol creado despues de guardar la foto de la sede)', async () => {
      const branchLayer = layer(
        4,
        [{ roleId: CAMPO, module: 'RESERVATION', action: 'READ_LIST', allowed: false }],
        { companyId: 'c-1', branchId: 'b-1' },
      );
      const service = new MatrixAuthorizationService(buildMatrix([branchLayer, orgLayer]));

      await expect(
        service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CONFIRM', { companyId: 'c-1', branchId: 'b-1' }),
      ).resolves.toBeUndefined();
      // ... y sin entrada en NINGUNA capa = denegado.
      await expect(
        service.assertAllowed('org-1', FRONT, 'RESERVATION', 'CANCEL_NO_SHOW', { companyId: 'c-1', branchId: 'b-1' }),
      ).rejects.toMatchObject({ response: { code: 'ROLE_NOT_ALLOWED' } });
    });
  });
});
