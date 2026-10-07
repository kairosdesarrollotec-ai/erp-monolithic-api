import { buildDefaultRolePermissionMatrix } from './default-role-permission-matrix';
import { PERMISSION_ACTION_CATALOG } from './permission-action-catalog';
import { WORKER_ROLES } from '../../users/domain/worker-role';

describe('buildDefaultRolePermissionMatrix (version 0 implicita)', () => {
  const roleIdByKey = new Map(WORKER_ROLES.map((key) => [key, `role-${key}`]));
  const matrix = buildDefaultRolePermissionMatrix(roleIdByKey);
  const allowed = (key: string, module: string, action: string) =>
    matrix.find((e) => e.roleId === `role-${key}` && e.module === module && e.action === action)?.allowed;

  it('una fila por (rol de sistema x accion del catalogo), por role_id', () => {
    expect(matrix).toHaveLength(WORKER_ROLES.length * PERMISSION_ACTION_CATALOG.length);
    expect(new Set(matrix.map((e) => e.roleId))).toEqual(new Set(WORKER_ROLES.map((key) => `role-${key}`)));
  });

  it('PLATFORM_ADMIN tiene todo el catalogo permitido como filas (ya no hay atajo en la autorizacion)', () => {
    const rows = matrix.filter((e) => e.roleId === 'role-PLATFORM_ADMIN');
    expect(rows).toHaveLength(PERMISSION_ACTION_CATALOG.length);
    expect(rows.every((e) => e.allowed)).toBe(true);
  });

  it('el resto de roles refleja las policies estaticas (incluida la correccion INCIDENT para CAMPO)', () => {
    expect(allowed('FRONT_OFFICE', 'RESERVATION', 'CREATE')).toBe(true);
    expect(allowed('CAMPO', 'RESERVATION', 'CREATE')).toBe(false);
    expect(allowed('CAMPO', 'INCIDENT', 'VIEW')).toBe(true);
    expect(allowed('CAMPO', 'INCIDENT', 'CREATE')).toBe(true);
    expect(allowed('CAMPO', 'INCIDENT', 'CLOSE')).toBe(false);
    expect(allowed('FINANZAS', 'INCIDENT', 'CLOSE')).toBe(false);
  });

  it('RETURN, FLEET, CUSTOMER tienen filas sembradas correctamente', () => {
    expect(allowed('GERENCIA', 'RETURN', 'CREATE')).toBe(true);
    expect(allowed('FINANZAS', 'RETURN', 'CREATE')).toBe(false);
    expect(allowed('FINANZAS', 'RETURN', 'CLOSE_FINANCIAL')).toBe(true);
    expect(allowed('CAMPO', 'FLEET', 'WRITE')).toBe(true);
    expect(allowed('AUDITORIA', 'FLEET', 'WRITE')).toBe(false);
    expect(allowed('CAMPO', 'FLEET', 'CROSS_BRANCH')).toBe(false);
    expect(allowed('GERENCIA', 'FLEET', 'CROSS_BRANCH')).toBe(true);
    expect(allowed('FRONT_OFFICE', 'CUSTOMER', 'WRITE')).toBe(true);
    expect(allowed('CAMPO', 'CUSTOMER', 'WRITE')).toBe(false);
  });

  it('un rol de sistema sin fila sembrada en la organizacion se omite (no inventa role_id)', () => {
    const partial = buildDefaultRolePermissionMatrix(new Map([['GERENCIA', 'role-GERENCIA']]));
    expect(new Set(partial.map((e) => e.roleId))).toEqual(new Set(['role-GERENCIA']));
  });
});
