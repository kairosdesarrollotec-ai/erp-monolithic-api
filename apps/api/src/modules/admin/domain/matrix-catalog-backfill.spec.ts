import { missingDefaultMatrixEntries } from './matrix-catalog-backfill';
import { PERMISSION_ACTION_CATALOG } from './permission-action-catalog';
import { WORKER_ROLES } from '../../users/domain/worker-role';

const roleIdByKey = new Map<string, string>(WORKER_ROLES.map((key) => [key, `role-${key}`]));
const NEW_ACTIONS = [
  'NOTIFICATIONS.RECEIVE_RETURN_ALERTS',
  'HR_ADMINISTRATION.MANAGE_AREAS',
  'HR_ADMINISTRATION.MANAGE_SALARY',
  'RECRUITMENT.DECIDE_NO_ADVANCE',
  'RECRUITMENT.TERMINATE_PROBATION',
  'EVIDENCE.REQUEST_DELETION',
  'EVIDENCE.APPROVE_DELETION',
];

/** Foto vieja: todo el catalogo MENOS las acciones nuevas, todo denegado salvo lo que se indique. */
function oldSnapshot(overrides: Record<string, boolean> = {}) {
  const rows: { roleId: string; action: string; allowed: boolean }[] = [];
  for (const key of WORKER_ROLES) {
    for (const d of PERMISSION_ACTION_CATALOG) {
      const action = `${d.module}.${d.action}`;
      if (NEW_ACTIONS.includes(action) || action === 'EVIDENCE.DELETE_DIRECT') continue;
      rows.push({ roleId: `role-${key}`, action, allowed: overrides[`${key}|${action}`] ?? false });
    }
  }
  return rows;
}

describe('missingDefaultMatrixEntries (P1: permisos nuevos en matrices ya guardadas)', () => {
  const find = (rows: ReturnType<typeof missingDefaultMatrixEntries>, role: string, action: string) =>
    rows.find((r) => r.roleId === `role-${role}` && `${r.module}.${r.action}` === action);

  it('devuelve solo las acciones sin fila, con la regla de la v0 por rol', () => {
    const missing = missingDefaultMatrixEntries(oldSnapshot(), roleIdByKey);
    expect(new Set(missing.map((r) => `${r.module}.${r.action}`))).toEqual(new Set([...NEW_ACTIONS, 'EVIDENCE.DELETE_DIRECT']));
    for (const role of ['FINANZAS', 'ADMINISTRACION', 'GERENCIA', 'PLATFORM_ADMIN']) {
      expect(find(missing, role, 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS')?.allowed).toBe(true);
    }
    for (const role of ['RRHH', 'CAMPO', 'AUDITORIA', 'FRONT_OFFICE']) {
      expect(find(missing, role, 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS')?.allowed).toBe(false);
    }
    for (const action of NEW_ACTIONS.filter((a) => /MANAGE_AREAS|MANAGE_SALARY|DECIDE_NO_ADVANCE|TERMINATE_PROBATION/.test(a))) {
      expect(find(missing, 'GERENCIA', action)?.allowed).toBe(true);
      expect(find(missing, 'PLATFORM_ADMIN', action)?.allowed).toBe(true);
      expect(find(missing, 'RRHH', action)?.allowed).toBe(false);
      expect(find(missing, 'ADMINISTRACION', action)?.allowed).toBe(false);
    }
    expect(find(missing, 'ADMINISTRACION', 'EVIDENCE.REQUEST_DELETION')?.allowed).toBe(true);
    expect(find(missing, 'GERENCIA', 'EVIDENCE.APPROVE_DELETION')?.allowed).toBe(true);
    expect(find(missing, 'GERENCIA', 'EVIDENCE.DELETE_DIRECT')?.allowed).toBe(false);
    expect(find(missing, 'PLATFORM_ADMIN', 'EVIDENCE.DELETE_DIRECT')?.allowed).toBe(true);
  });

  it('NO pisa una celda retirada a proposito: una accion con fila (aunque allowed=false) no se vuelve a sembrar', () => {
    const snapshot = [
      ...oldSnapshot(),
      // El admin ya tenia (y retiro) una de las acciones nuevas: existe como fila denegada.
      { roleId: 'role-GERENCIA', action: 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS', allowed: false },
    ];
    const missing = missingDefaultMatrixEntries(snapshot, roleIdByKey);
    expect(find(missing, 'GERENCIA', 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS')).toBeUndefined();
    expect(find(missing, 'FINANZAS', 'NOTIFICATIONS.RECEIVE_RETURN_ALERTS')?.allowed).toBe(true);
  });

  it('es idempotente: con las filas ya insertadas no queda nada por sembrar', () => {
    const first = missingDefaultMatrixEntries(oldSnapshot(), roleIdByKey);
    const after = [...oldSnapshot(), ...first.map((e) => ({ roleId: e.roleId, action: `${e.module}.${e.action}`, allowed: e.allowed }))];
    expect(missingDefaultMatrixEntries(after, roleIdByKey)).toEqual([]);
  });

  it('solo toca roles que ya estan en la foto (un rol creado a mano o sin filas no recibe permisos)', () => {
    const onlyGerencia = oldSnapshot().filter((r) => r.roleId === 'role-GERENCIA');
    const missing = missingDefaultMatrixEntries(onlyGerencia, roleIdByKey);
    expect(new Set(missing.map((r) => r.roleId))).toEqual(new Set(['role-GERENCIA']));
  });
});
