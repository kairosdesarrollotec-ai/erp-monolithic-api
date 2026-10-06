import type { WorkerRole } from '../domain/worker-role';

/**
 * Fixtures de tests (no se usan en runtime) para el contexto de trabajo con
 * roles dinamicos: una asignacion de un rol de SISTEMA se simula con
 * roleId = `role-<KEY>`, roleName = <KEY>, roleKey = <KEY>. Las "matrices
 * simuladas" de los specs vuelven a la key con `roleKeyOfTestRoleId` para
 * aplicar la misma politica rol-accion que es la version 0 real.
 */
export function testRoleId(key: WorkerRole | string): string {
  return `role-${key}`;
}

export function roleKeyOfTestRoleId(roleId: string): WorkerRole {
  return roleId.replace(/^role-/, '') as WorkerRole;
}

/** Campos de rol de un AuthorizedWorkContext para un rol de sistema. */
export function testRole(key: WorkerRole | string): { roleId: string; roleName: string; roleKey: WorkerRole } {
  return { roleId: testRoleId(key), roleName: String(key), roleKey: key as WorkerRole };
}
