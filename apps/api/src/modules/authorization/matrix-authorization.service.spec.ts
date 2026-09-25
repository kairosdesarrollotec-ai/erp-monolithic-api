import { ForbiddenException } from '@nestjs/common';
import { MatrixAuthorizationService } from './matrix-authorization.service';
import { RolePermissionMatrixPort, RolePermissionMatrixSnapshot } from '../admin/application/ports/role-permission-matrix.port';

function buildMatrix(snapshot: RolePermissionMatrixSnapshot): jest.Mocked<RolePermissionMatrixPort> {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue(snapshot),
    saveNewVersion: jest.fn(),
  };
}

describe('MatrixAuthorizationService', () => {
  it('permite una accion cuando la matriz vigente tiene una entrada con allowed=true', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [
        { role: 'FRONT_OFFICE', module: 'RESERVATION', action: 'CREATE', allowed: true },
        { role: 'FRONT_OFFICE', module: 'INQUIRY', action: 'REGISTER', allowed: true },
        { role: 'ADMINISTRACION', module: 'ADMIN', action: 'MANAGE_USERS', allowed: true },
      ],
    });
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', 'FRONT_OFFICE', 'RESERVATION', 'CREATE')).resolves.toBeUndefined();
    await expect(service.assertAllowed('org-1', 'FRONT_OFFICE', 'INQUIRY', 'REGISTER')).resolves.toBeUndefined();
    await expect(service.assertAllowed('org-1', 'ADMINISTRACION', 'ADMIN', 'MANAGE_USERS')).resolves.toBeUndefined();
    expect(await service.isAllowed('org-1', 'FRONT_OFFICE', 'RESERVATION', 'CREATE')).toBe(true);
  });

  it('deniega (403 ROLE_NOT_ALLOWED) para RESERVATION cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [
        { role: 'FRONT_OFFICE', module: 'RESERVATION', action: 'CREATE', allowed: false },
      ],
    });
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', 'FRONT_OFFICE', 'RESERVATION', 'CREATE')).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
    // Entrada inexistente -> deny-by-default
    await expect(service.assertAllowed('org-1', 'CAMPO', 'RESERVATION', 'CREATE')).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
    expect(await service.isAllowed('org-1', 'FRONT_OFFICE', 'RESERVATION', 'CREATE')).toBe(false);
  });

  it('deniega (403 ROLE_NOT_ALLOWED) para INQUIRY cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix({
      version: 2,
      entries: [
        { role: 'CAMPO', module: 'INQUIRY', action: 'READ', allowed: false },
      ],
    });
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', 'CAMPO', 'INQUIRY', 'READ')).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
    await expect(service.assertAllowed('org-1', 'CAMPO', 'INQUIRY', 'REGISTER')).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
  });

  it('deniega (403 ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX) para ADMIN cuando allowed=false o no existe', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [
        { role: 'FRONT_OFFICE', module: 'ADMIN', action: 'MANAGE_USERS', allowed: false },
      ],
    });
    const service = new MatrixAuthorizationService(matrix);

    await expect(service.assertAllowed('org-1', 'FRONT_OFFICE', 'ADMIN', 'MANAGE_USERS')).rejects.toMatchObject({
      response: {
        code: 'ADMIN_ACTION_NOT_ALLOWED_BY_MATRIX',
      },
    });
  });

  it('no confunde una entrada de otro modulo con el mismo nombre de accion', async () => {
    const matrix = buildMatrix({
      version: 1,
      entries: [
        { role: 'ADMINISTRACION', module: 'RESERVATION', action: 'READ', allowed: true },
      ],
    });
    const service = new MatrixAuthorizationService(matrix);

    // READ esta permitido para RESERVATION pero no para INQUIRY
    await expect(service.assertAllowed('org-1', 'ADMINISTRACION', 'INQUIRY', 'READ')).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
  });
});
