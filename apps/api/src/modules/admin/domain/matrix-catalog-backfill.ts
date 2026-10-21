import type { RolePermissionEntry } from '../application/ports/role-permission-matrix.port';
import { buildDefaultRolePermissionMatrix } from './default-role-permission-matrix';

/**
 * Permisos NUEVOS del catalogo en organizaciones cuya matriz ya fue guardada (frente B2, P1 del 21-oct-2026).
 *
 * Una foto guardada de la matriz es completa SOLO para las acciones que existian al guardarla: una accion agregada despues
 * al catalogo no tiene fila y, por deny-by-default, queda DENEGADA para todos hasta que el administrador vuelva a guardar.
 * Esta funcion calcula las filas que faltan con la regla de la version 0 (las `*-role-policy.ts`), para insertarlas SIN pisar nada:
 *  - solo (rol, accion) SIN fila en la foto: una celda que el administrador retiro a proposito existe como fila `allowed = false`
 *    y por eso nunca se toca (la ausencia de fila distingue «nunca existio» de «retirado a proposito»);
 *  - solo roles de sistema que YA tienen filas en la foto (un rol creado a mano o posterior queda como esta: cero permisos);
 *  - es idempotente: tras insertar, una segunda corrida no encuentra faltantes.
 *
 * @param existing filas de la foto vigente de la organizacion (`action` = `MODULO.ACCION`, formato de la tabla).
 */
export function missingDefaultMatrixEntries(
  existing: readonly { roleId: string; action: string }[],
  roleIdByKey: ReadonlyMap<string, string>,
): RolePermissionEntry[] {
  const rolesInSnapshot = new Set(existing.map((row) => row.roleId));
  const present = new Set(existing.map((row) => `${row.roleId}|${row.action}`));
  return buildDefaultRolePermissionMatrix(roleIdByKey).filter(
    (entry) => rolesInSnapshot.has(entry.roleId) && !present.has(`${entry.roleId}|${entry.module}.${entry.action}`),
  );
}
