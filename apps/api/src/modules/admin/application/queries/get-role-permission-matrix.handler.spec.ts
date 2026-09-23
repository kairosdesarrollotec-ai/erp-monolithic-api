import { ForbiddenException } from '@nestjs/common';
import { GetRolePermissionMatrixHandler } from './get-role-permission-matrix.handler';
import { GetRolePermissionMatrixQuery } from './get-role-permission-matrix.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort } from '../ports/role-permission-matrix.port';
import type { WorkerRole } from '../../../users/domain/worker-role';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION') {
  return {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;
}

function buildMatrix() {
  const port: jest.Mocked<RolePermissionMatrixPort> = {
    getCurrentVersion: jest.fn().mockResolvedValue({
      version: 0,
      entries: [{ role: 'FRONT_OFFICE', module: 'RESERVATION', action: 'CREATE', allowed: true }],
    }),
    saveNewVersion: jest.fn(),
  };
  return port;
}

describe('GetRolePermissionMatrixHandler', () => {
  it('devuelve la matriz vigente junto con el catalogo de acciones', async () => {
    const authorization = buildAuthorization();
    const matrix = buildMatrix();
    const handler = new GetRolePermissionMatrixHandler(authorization, matrix);

    const result = await handler.execute(new GetRolePermissionMatrixQuery('uid-admin', 'company-1', 'branch-1'));

    expect(matrix.getCurrentVersion).toHaveBeenCalledWith('org-1');
    expect(result.version).toBe(0);
    expect(result.entries).toHaveLength(1);
    expect(result.actionCatalog.length).toBeGreaterThan(0);
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const authorization = buildAuthorization('FRONT_OFFICE');
    const handler = new GetRolePermissionMatrixHandler(authorization, buildMatrix());

    await expect(
      handler.execute(new GetRolePermissionMatrixQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
