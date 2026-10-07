import { ForbiddenException } from '@nestjs/common';
import { ListRolesHandler } from './list-roles.handler';
import { ListRolesQuery } from './list-roles.query';
import { GetMyPermissionsHandler } from './get-my-permissions.handler';
import { GetMyPermissionsQuery } from './get-my-permissions.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { RoleRepositoryPort } from '../ports/role-repository.port';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';
import { testRole } from '../../../users/testing/role-fixtures';

function workContext(key: any = 'GERENCIA') {
  return {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(key) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

describe('ListRolesHandler', () => {
  function build(allowed = true) {
    const adminAuthorization = {
      assertAllowed: jest.fn().mockImplementation(async () => {
        if (!allowed) throw new ForbiddenException();
      }),
    } as unknown as jest.Mocked<AdminMatrixAuthorizationService>;
    const roles = { listByOrganization: jest.fn().mockResolvedValue([{ id: 'r1', assignmentCount: 2 }]) } as unknown as jest.Mocked<RoleRepositoryPort>;
    return { adminAuthorization, roles, handler: new ListRolesHandler(workContext('ADMINISTRACION'), adminAuthorization, roles) };
  }

  it('lista los roles de la organizacion del actor (por defecto sin inactivos) tras exigir MANAGE_PERMISSIONS', async () => {
    const { handler, roles, adminAuthorization } = build();

    const result = await handler.execute(new ListRolesQuery('uid', 'company-1', 'branch-1', false));

    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith('org-1', 'role-ADMINISTRACION', 'MANAGE_PERMISSIONS', { companyId: 'company-1', branchId: 'branch-1' });
    expect(roles.listByOrganization).toHaveBeenCalledWith('org-1', { includeInactive: false });
    expect(result).toHaveLength(1);
  });

  it('includeInactive=true se propaga', async () => {
    const { handler, roles } = build();
    await handler.execute(new ListRolesQuery('uid', 'company-1', 'branch-1', true));
    expect(roles.listByOrganization).toHaveBeenCalledWith('org-1', { includeInactive: true });
  });

  it('403 sin permiso', async () => {
    const { handler, roles } = build(false);
    await expect(handler.execute(new ListRolesQuery('uid', 'company-1', 'branch-1', false))).rejects.toBeInstanceOf(ForbiddenException);
    expect(roles.listByOrganization).not.toHaveBeenCalled();
  });
});

describe('GetMyPermissionsHandler', () => {
  const org: RolePermissionMatrixSnapshot = {
    version: 2,
    scope: { companyId: null, branchId: null },
    entries: [
      { roleId: 'role-GERENCIA', module: 'RESERVATION', action: 'CREATE', allowed: true },
      { roleId: 'role-GERENCIA', module: 'RESERVATION', action: 'CONFIRM', allowed: true },
      { roleId: 'role-GERENCIA', module: 'INQUIRY', action: 'READ', allowed: false },
      { roleId: 'role-OTRO', module: 'RENTAL', action: 'READ', allowed: true },
    ],
  };
  const branch: RolePermissionMatrixSnapshot = {
    version: 5,
    scope: { companyId: 'company-1', branchId: 'branch-1' },
    entries: [{ roleId: 'role-GERENCIA', module: 'RESERVATION', action: 'CONFIRM', allowed: false }],
  };

  it('devuelve el rol, la version mas alta de las capas y solo las acciones permitidas (sede pisa a organizacion)', async () => {
    const matrix = { getLayers: jest.fn().mockResolvedValue([branch, org]) } as unknown as jest.Mocked<RolePermissionMatrixPort>;
    const handler = new GetMyPermissionsHandler(workContext('GERENCIA'), matrix);

    const result = await handler.execute(new GetMyPermissionsQuery('uid', 'company-1', 'branch-1'));

    expect(matrix.getLayers).toHaveBeenCalledWith('org-1', { companyId: 'company-1', branchId: 'branch-1' }, { roleId: 'role-GERENCIA' });
    expect(result.role).toEqual({ id: 'role-GERENCIA', name: 'GERENCIA', key: 'GERENCIA' });
    expect(result.matrixVersion).toBe(5);
    expect(result.permissions).toEqual([{ module: 'RESERVATION', action: 'CREATE' }]);
  });

  it('sin entradas = deny-by-default (lista vacia, version 0)', async () => {
    const matrix = { getLayers: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<RolePermissionMatrixPort>;
    const handler = new GetMyPermissionsHandler(workContext('CAMPO'), matrix);

    const result = await handler.execute(new GetMyPermissionsQuery('uid', 'company-1', 'branch-1'));

    expect(result.permissions).toEqual([]);
    expect(result.matrixVersion).toBe(0);
  });

  it('propaga el 403 del contexto de trabajo sin leer la matriz', async () => {
    const authorization = { authorize: jest.fn().mockRejectedValue(new ForbiddenException()) } as unknown as WorkContextAuthorizationService;
    const matrix = { getLayers: jest.fn() } as unknown as jest.Mocked<RolePermissionMatrixPort>;
    const handler = new GetMyPermissionsHandler(authorization, matrix);

    await expect(handler.execute(new GetMyPermissionsQuery('uid', 'c', 'b'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(matrix.getLayers).not.toHaveBeenCalled();
  });
});
