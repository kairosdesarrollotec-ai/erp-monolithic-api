import { ForbiddenException } from '@nestjs/common';
import { AdminMatrixAuthorizationService } from './admin-matrix-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../ports/role-permission-matrix.port';

function buildMatrix(snapshot: RolePermissionMatrixSnapshot): jest.Mocked<RolePermissionMatrixPort> {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue(snapshot),
    saveNewVersion: jest.fn(),
  };
}

describe('AdminMatrixAuthorizationService', () => {
  it('permite la accion cuando la matriz vigente tiene una entrada (rol, ADMIN, accion) con allowed=true', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [{ role: 'ADMINISTRACION', module: 'ADMIN', action: 'MANAGE_USERS', allowed: true }],
    });
    const service = new AdminMatrixAuthorizationService(new MatrixAuthorizationService(matrix));

    await expect(service.assertAllowed('org-1', 'ADMINISTRACION', 'MANAGE_USERS')).resolves.toBeUndefined();
    expect(matrix.getCurrentVersion).toHaveBeenCalledWith('org-1');
  });

  it('deniega (403) cuando la entrada existe pero allowed=false', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [{ role: 'FRONT_OFFICE', module: 'ADMIN', action: 'MANAGE_USERS', allowed: false }],
    });
    const service = new AdminMatrixAuthorizationService(new MatrixAuthorizationService(matrix));

    await expect(service.assertAllowed('org-1', 'FRONT_OFFICE', 'MANAGE_USERS')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deniega por defecto (deny-by-default) cuando no hay ninguna entrada para (rol, ADMIN, accion)', async () => {
    const matrix = buildMatrix({ version: 1, entries: [] });
    const service = new AdminMatrixAuthorizationService(new MatrixAuthorizationService(matrix));

    await expect(service.assertAllowed('org-1', 'ADMINISTRACION', 'MANAGE_PERMISSIONS')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('no confunde una entrada de otro modulo con el mismo nombre de accion', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [{ role: 'ADMINISTRACION', module: 'RESERVATION', action: 'MANAGE_USERS' as never, allowed: true }],
    });
    const service = new AdminMatrixAuthorizationService(new MatrixAuthorizationService(matrix));

    await expect(service.assertAllowed('org-1', 'ADMINISTRACION', 'MANAGE_USERS')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
