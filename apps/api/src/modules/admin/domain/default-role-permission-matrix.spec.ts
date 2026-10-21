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

  it('HR_ADMINISTRATION tiene filas sembradas reflejando hr-administration-role-policy', () => {
    expect(allowed('GERENCIA', 'HR_ADMINISTRATION', 'TERMINATE_EMPLOYMENT')).toBe(true);
    expect(allowed('RRHH', 'HR_ADMINISTRATION', 'AUTHORIZE_LEAVE')).toBe(true);
    expect(allowed('ADMINISTRACION', 'HR_ADMINISTRATION', 'LOG_ATTENDANCE')).toBe(true);
    expect(allowed('ADMINISTRACION', 'HR_ADMINISTRATION', 'AUTHORIZE_LEAVE')).toBe(false);
    expect(allowed('CAMPO', 'HR_ADMINISTRATION', 'REQUEST_FIELD_TRIP')).toBe(true);
    expect(allowed('CAMPO', 'HR_ADMINISTRATION', 'MANAGE_EMPLOYEES')).toBe(false);
    expect(allowed('AUDITORIA', 'HR_ADMINISTRATION', 'VIEW_EMPLOYEES')).toBe(true);
  });

  it('acciones nuevas de Reserva: FLAG_SALE/RESOLVE_SALE para Gerencia y Administracion; CHANGE_VEHICLE para el personal operativo', () => {
    for (const action of ['FLAG_SALE', 'RESOLVE_SALE']) {
      expect(allowed('GERENCIA', 'RESERVATION', action)).toBe(true);
      expect(allowed('ADMINISTRACION', 'RESERVATION', action)).toBe(true);
      expect(allowed('FRONT_OFFICE', 'RESERVATION', action)).toBe(false);
      expect(allowed('CAMPO', 'RESERVATION', action)).toBe(false);
      expect(allowed('PLATFORM_ADMIN', 'RESERVATION', action)).toBe(true);
    }
    expect(allowed('FRONT_OFFICE', 'RESERVATION', 'CHANGE_VEHICLE')).toBe(true);
    expect(allowed('GERENCIA', 'RESERVATION', 'CHANGE_VEHICLE')).toBe(true);
    expect(allowed('AUDITORIA', 'RESERVATION', 'CHANGE_VEHICLE')).toBe(false);
  });

  it('PAYMENT se siembra desde payment-role-policy y REPORT queda denegado (sin regla documentada)', () => {
    expect(allowed('FINANZAS', 'PAYMENT', 'APPROVE_REFUND')).toBe(true);
    expect(allowed('FRONT_OFFICE', 'PAYMENT', 'APPROVE_REFUND')).toBe(false);
    expect(allowed('FRONT_OFFICE', 'PAYMENT', 'REGISTER_ADJUSTMENT')).toBe(true);
    expect(allowed('AUDITORIA', 'PAYMENT', 'READ_LIST')).toBe(true);
    expect(allowed('GERENCIA', 'REPORT', 'READ_OPERATIONAL')).toBe(false);
    expect(allowed('PLATFORM_ADMIN', 'REPORT', 'EXPORT')).toBe(true);
  });

  it('NOTIFICATIONS.RECEIVE_RETURN_ALERTS: v0 = Finanzas, Administracion y Gerencia (+ PLATFORM_ADMIN); el resto no', () => {
    for (const role of ['FINANZAS', 'ADMINISTRACION', 'GERENCIA', 'PLATFORM_ADMIN'] as const) {
      expect(allowed(role, 'NOTIFICATIONS', 'RECEIVE_RETURN_ALERTS')).toBe(true);
    }
    for (const role of ['FRONT_OFFICE', 'CAMPO', 'AUDITORIA', 'RRHH'] as const) {
      expect(allowed(role, 'NOTIFICATIONS', 'RECEIVE_RETURN_ALERTS')).toBe(false);
    }
  });

  it('HR_ADMINISTRATION.MANAGE_AREAS / MANAGE_SALARY solo GERENCIA (+ PLATFORM_ADMIN) en la v0; RECRUITMENT.DECIDE_NO_ADVANCE / TERMINATE_PROBATION idem', () => {
    for (const [module, action] of [['HR_ADMINISTRATION', 'MANAGE_AREAS'], ['HR_ADMINISTRATION', 'MANAGE_SALARY'], ['RECRUITMENT', 'DECIDE_NO_ADVANCE'], ['RECRUITMENT', 'TERMINATE_PROBATION']] as const) {
      expect(allowed('GERENCIA', module, action)).toBe(true);
      expect(allowed('PLATFORM_ADMIN', module, action)).toBe(true);
      for (const role of ['RRHH', 'ADMINISTRACION', 'FINANZAS', 'AUDITORIA', 'CAMPO', 'FRONT_OFFICE'] as const) {
        expect(allowed(role, module, action)).toBe(false);
      }
    }
  });

  it('UPLOAD_EVIDENCE (reutilizada para borrar evidencia) sigue en el catalogo de Alquiler y Devolucion', () => {
    expect(PERMISSION_ACTION_CATALOG.some((d) => d.module === 'RENTAL' && d.action === 'UPLOAD_EVIDENCE')).toBe(true);
    expect(PERMISSION_ACTION_CATALOG.some((d) => d.module === 'RETURN' && d.action === 'UPLOAD_EVIDENCE')).toBe(true);
  });

  it('un rol de sistema sin fila sembrada en la organizacion se omite (no inventa role_id)', () => {
    const partial = buildDefaultRolePermissionMatrix(new Map([['GERENCIA', 'role-GERENCIA']]));
    expect(new Set(partial.map((e) => e.roleId))).toEqual(new Set(['role-GERENCIA']));
  });
});
