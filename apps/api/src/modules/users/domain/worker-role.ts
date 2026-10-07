/**
 * ROLES DINAMICOS (fase 2, ver claude/Diseno_Roles_Dinamicos_y_Permisos.md):
 * el rol de una asignacion ya NO es este enum sino un dato de la organizacion
 * (tabla `roles`, `RoleRef` = {id, name, key} en el contrato). `WorkerRole`
 * sobrevive unicamente como CATALOGO de las `key` estables de los 8 roles de
 * sistema sembrados:
 *   - la version 0 implicita de la matriz ADM-02 (`*-role-policy.ts` ->
 *     `buildDefaultRolePermissionMatrix`) se mapea key -> role_id por
 *     organizacion;
 *   - el tablero por rol (`dashboard_items.role`) y los modulos que aun usan
 *     sets de roles hard-coded (Returns, Customers, Fleet - fase 4) siguen
 *     decidiendo por `roleKey`. Un rol creado a mano (key = null) queda
 *     denegado ahi (deny-by-default) hasta que esos modulos migren a la matriz.
 * La autorizacion NUEVA se evalua siempre por permisos
 * (MatrixAuthorizationService.assertAllowed por roleId), nunca por rol.
 *
 * `WORKER_ROLES` es el array en tiempo de ejecucion que respalda el tipo y la
 * unica fuente que worker-role.equivalence.spec.ts usa para verificar que el
 * enum de apps/api/prisma/schema.prisma y la lista de keys del contrato
 * (admin.yaml, RoleRef.key) no se desalineen.
 */
export const WORKER_ROLES = [
  'ADMINISTRACION',
  'AUDITORIA',
  'CAMPO',
  'FINANZAS',
  'FRONT_OFFICE',
  'GERENCIA',
  'PLATFORM_ADMIN',
  'RRHH',
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number];


export function isWorkerRole(value: string | null | undefined): value is WorkerRole {
  return typeof value === 'string' && (WORKER_ROLES as readonly string[]).includes(value);
}

/** `roles.key` (texto libre en BD) -> clave de sistema conocida; null si es un rol creado a mano. */
export function toWorkerRoleKey(key: string | null | undefined): WorkerRole | null {
  return isWorkerRole(key) ? key : null;
}

/** Referencia de rol que viaja en las respuestas (`RoleRef` del contrato). */
export interface RoleRef {
  id: string;
  name: string;
  key: WorkerRole | null;
}
