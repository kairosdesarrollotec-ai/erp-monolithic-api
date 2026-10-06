import { ForbiddenException } from '@nestjs/common';
import { buildDefaultRolePermissionMatrix } from '../../../admin/domain/default-role-permission-matrix';
import { PERMISSION_ACTION_CATALOG } from '../../../admin/domain/permission-action-catalog';
import { WORKER_ROLES } from '../../../users/domain/worker-role';
import { assertIncidentRoleAllowed, IncidentAction, isIncidentRoleAllowed } from './incident-role-policy';

describe('incident-role-policy (INCIDENT.*)', () => {
  const WRITE: IncidentAction[] = ['CREATE', 'ADD_ACTION', 'RESOLVE', 'CLOSE', 'REFER_LEGAL'];

  it.each(['FRONT_OFFICE', 'GERENCIA', 'FINANZAS', 'AUDITORIA'] as const)('%s puede ver incidencias', (role) => {
    expect(isIncidentRoleAllowed(role, 'VIEW')).toBe(true);
  });

  it.each(['FRONT_OFFICE', 'GERENCIA'] as const)('%s puede registrar, agregar accion, resolver, cerrar y derivar', (role) => {
    for (const action of WRITE) expect(isIncidentRoleAllowed(role, action)).toBe(true);
  });

  it.each(['FINANZAS', 'AUDITORIA'] as const)('%s es solo lectura', (role) => {
    for (const action of WRITE) expect(isIncidentRoleAllowed(role, action)).toBe(false);
  });

  it.each(['ADMINISTRACION', 'CAMPO', 'RRHH'] as const)('%s queda denegado por defecto', (role) => {
    for (const action of ['VIEW', ...WRITE] as IncidentAction[]) expect(isIncidentRoleAllowed(role, action)).toBe(false);
  });

  it('PLATFORM_ADMIN siempre pasa y no se crea ningun rol nuevo', () => {
    expect(WORKER_ROLES).toHaveLength(8);
    expect(isIncidentRoleAllowed('PLATFORM_ADMIN', 'CLOSE')).toBe(true);
  });

  it('assert lanza 403 ROLE_NOT_ALLOWED', () => {
    expect(() => assertIncidentRoleAllowed('FINANZAS', 'CLOSE')).toThrow(ForbiddenException);
    expect(() => assertIncidentRoleAllowed('GERENCIA', 'CLOSE')).not.toThrow();
  });

  it('el catalogo ADM-02 expone las 6 acciones INCIDENT y la matriz v0 las deriva de esta politica', () => {
    const catalogActions = PERMISSION_ACTION_CATALOG.filter((d) => d.module === 'INCIDENT').map((d) => d.action).sort();
    expect(catalogActions).toEqual(['ADD_ACTION', 'CLOSE', 'CREATE', 'REFER_LEGAL', 'RESOLVE', 'VIEW']);

    const entries = buildDefaultRolePermissionMatrix().filter((e) => e.module === 'INCIDENT');
    expect(entries).toHaveLength(WORKER_ROLES.length * 6);
    for (const entry of entries) {
      expect(entry.allowed).toBe(isIncidentRoleAllowed(entry.role, entry.action as IncidentAction));
    }
    const allowedFor = (action: string) => entries.filter((e) => e.action === action && e.allowed).map((e) => e.role).sort();
    expect(allowedFor('VIEW')).toEqual(['AUDITORIA', 'FINANZAS', 'FRONT_OFFICE', 'GERENCIA', 'PLATFORM_ADMIN']);
    expect(allowedFor('CLOSE')).toEqual(['FRONT_OFFICE', 'GERENCIA', 'PLATFORM_ADMIN']);
  });
});
