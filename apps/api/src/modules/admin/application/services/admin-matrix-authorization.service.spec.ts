import { ForbiddenException } from '@nestjs/common';
import { AdminMatrixAuthorizationService } from './admin-matrix-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import {
  ORGANIZATION_SCOPE,
  RolePermissionMatrixPort,
  RolePermissionMatrixSnapshot,
} from '../ports/role-permission-matrix.port';

function buildService(layers: RolePermissionMatrixSnapshot[]) {
  const matrix: jest.Mocked<RolePermissionMatrixPort> = {
    getLayers: jest.fn().mockResolvedValue(layers),
    getCurrentVersion: jest.fn(),
    getAllCurrentSnapshots: jest.fn(),
    saveNewVersion: jest.fn(),
  };
  return new AdminMatrixAuthorizationService(new MatrixAuthorizationService(matrix));
}

describe('AdminMatrixAuthorizationService', () => {
  it('permite la accion ADMIN cuando la matriz tiene allowed=true para el roleId', async () => {
    const service = buildService([
      {
        version: 2,
        scope: ORGANIZATION_SCOPE,
        entries: [{ roleId: 'role-admin', module: 'ADMIN', action: 'MANAGE_USERS', allowed: true }],
      },
    ]);

    await expect(service.assertAllowed('org-1', 'role-admin', 'MANAGE_USERS')).resolves.toBeUndefined();
  });

  it('deniega con ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX cuando allowed=false o no existe entrada', async () => {
    const service = buildService([
      {
        version: 2,
        scope: ORGANIZATION_SCOPE,
        entries: [{ roleId: 'role-front', module: 'ADMIN', action: 'MANAGE_USERS', allowed: false }],
      },
    ]);

    await expect(service.assertAllowed('org-1', 'role-front', 'MANAGE_USERS')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertAllowed('org-1', 'role-otro', 'VIEW_AUDIT')).rejects.toMatchObject({
      response: { code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX' },
    });
  });

  it('ya no existe el atajo PLATFORM_ADMIN: un rol sin entradas se deniega aunque se llame PLATFORM_ADMIN', async () => {
    const service = buildService([{ version: 1, scope: ORGANIZATION_SCOPE, entries: [] }]);

    await expect(service.assertAllowed('org-1', 'role-PLATFORM_ADMIN', 'MANAGE_PERMISSIONS')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
