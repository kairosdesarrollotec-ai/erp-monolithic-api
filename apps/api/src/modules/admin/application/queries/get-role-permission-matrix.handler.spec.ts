import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GetRolePermissionMatrixHandler } from './get-role-permission-matrix.handler';
import { GetRolePermissionMatrixQuery } from './get-role-permission-matrix.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort } from '../ports/role-permission-matrix.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { MatrixScopeService } from '../services/matrix-scope.service';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { testRole } from '../../../users/testing/role-fixtures';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION') {
  return {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as WorkContextAuthorizationService;
}

function buildAdminAuthorization(allowed = true) {
  return {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenException();
    }),
  } as unknown as jest.Mocked<AdminMatrixAuthorizationService>;
}

function buildMatrix() {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue({
      version: 0,
      scope: { companyId: null, branchId: null },
      entries: [{ roleId: 'role-FRONT_OFFICE', module: 'RESERVATION', action: 'CREATE', allowed: true }],
    }),
  } as unknown as jest.Mocked<RolePermissionMatrixPort>;
}

function buildScopes(error?: Error) {
  return {
    resolve: jest.fn().mockImplementation(async (_org: string, companyId?: string | null, branchId?: string | null) => {
      if (error) throw error;
      return { companyId: companyId ?? null, branchId: branchId ?? null };
    }),
  } as unknown as jest.Mocked<MatrixScopeService>;
}

describe('GetRolePermissionMatrixHandler', () => {
  it('devuelve la matriz vigente (por roleId) junto con el catalogo de acciones y autoriza por roleId + scope', async () => {
    const adminAuthorization = buildAdminAuthorization(true);
    const matrix = buildMatrix();
    const scopes = buildScopes();
    const handler = new GetRolePermissionMatrixHandler(buildAuthorization(), adminAuthorization, matrix, scopes);

    const result = await handler.execute(new GetRolePermissionMatrixQuery('uid-admin', 'company-1', 'branch-1'));

    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith('org-1', 'role-ADMINISTRACION', 'MANAGE_PERMISSIONS', {
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(scopes.resolve).toHaveBeenCalledWith('org-1', undefined, undefined);
    expect(matrix.getCurrentVersion).toHaveBeenCalledWith('org-1', { companyId: null, branchId: null });
    expect(result.version).toBe(0);
    expect(result.scope).toEqual({ companyId: null, branchId: null });
    expect(result.entries).toHaveLength(1);
    expect(result.actionCatalog.length).toBeGreaterThan(0);
  });

  it('consulta el ambito pedido (empresa/sede) una vez validado', async () => {
    const matrix = buildMatrix();
    const handler = new GetRolePermissionMatrixHandler(buildAuthorization(), buildAdminAuthorization(true), matrix, buildScopes());

    await handler.execute(new GetRolePermissionMatrixQuery('uid-admin', 'company-1', 'branch-1', 'company-2', 'branch-2'));

    expect(matrix.getCurrentVersion).toHaveBeenCalledWith('org-1', { companyId: 'company-2', branchId: 'branch-2' });
  });

  it('propaga el 400 del ambito invalido sin leer la matriz', async () => {
    const matrix = buildMatrix();
    const handler = new GetRolePermissionMatrixHandler(
      buildAuthorization(),
      buildAdminAuthorization(true),
      matrix,
      buildScopes(new BadRequestException({ code: 'MATRIX_SCOPE_INVALID' })),
    );

    await expect(
      handler.execute(new GetRolePermissionMatrixQuery('uid-admin', 'company-1', 'branch-1', null, 'branch-2')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.getCurrentVersion).not.toHaveBeenCalled();
  });

  it('rechaza cuando el rol autorizado no tiene ADMIN.MANAGE_PERMISSIONS', async () => {
    const handler = new GetRolePermissionMatrixHandler(
      buildAuthorization('FRONT_OFFICE'),
      buildAdminAuthorization(false),
      buildMatrix(),
      buildScopes(),
    );

    await expect(
      handler.execute(new GetRolePermissionMatrixQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
