import { ForbiddenException } from '@nestjs/common';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * PROVISIONAL: guarda de roles minima para el modulo de Flota mientras ADM-02
 * (matriz rol-accion-empresa-sede versionada) no exista. Cuando ADM-02 este
 * construido, reemplazar por su assertAllowed().
 *
 * Fuente autorizada: SDD-KAIROS-TRANSVERSAL.md §15.5 (catalogo de roles).
 *   - CAMPO    = Fleet Operator  — gestiona vehiculos, entrega y devolucion.
 *   - GERENCIA = Operations Manager — aprobaciones operativas.
 *   - ADMINISTRACION = Company Administrator — usuarios y configuracion.
 *   - PLATFORM_ADMIN — solo configuracion tecnica, acceso operativo provisional.
 *
 * La denegacion por defecto excluye: AUDITORIA (solo lectura corporativa),
 * FINANZAS, FRONT_OFFICE, RRHH para operaciones de escritura sobre flota.
 */
const FLEET_WRITE_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'CAMPO',
  'PLATFORM_ADMIN',
]);

/** Roles que pueden leer el catalogo de flota (no incluye READ_ONLY implicito). */
const FLEET_READ_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'CAMPO',
  'FRONT_OFFICE',
  'FINANZAS',
  'AUDITORIA',
  'PLATFORM_ADMIN',
]);

/** Roles que pueden operar sobre sedes distintas a la propia dentro de la empresa. */
const CROSS_BRANCH_ROLES: ReadonlySet<WorkerRole> = new Set([
  'GERENCIA',
  'ADMINISTRACION',
  'PLATFORM_ADMIN',
]);

/**
 * TODO(roles-dinamicos, fase 4): este modulo AUN decide con un set de roles
 * hard-coded, ahora contra `roleKey` (clave estable de los 8 roles de sistema,
 * AuthorizedWorkContext.roleKey). Un rol creado a mano (key = null) queda
 * DENEGADO aqui (deny-by-default) hasta que el modulo migre a la matriz ADM-02
 * (MatrixAuthorizationService.assertAllowed por roleId) en su propio PR de la
 * fase 4. No migrar en el PR de la fase 2.
 */
export function assertFleetWrite(role: WorkerRole | null): void {
  if (role === null || !FLEET_WRITE_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'FLEET_WRITE_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no tiene permiso para modificar la flota de vehículos.`,
    });
  }
}

export function assertFleetRead(role: WorkerRole | null): void {
  if (role === null || !FLEET_READ_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'FLEET_READ_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no tiene permiso para consultar la flota de vehículos.`,
    });
  }
}

/**
 * Solo para buildDefaultRolePermissionMatrix: verifica si el rol tiene acceso cross-branch
 * sin comparar branches concretos. El check real de aislamiento en tiempo de ejecucion
 * se delega a assertCrossBranchAllowed (que recibe el branchId real).
 */
export function assertFleetCrossBranchPermission(role: WorkerRole | null): void {
  if (role === null || !CROSS_BRANCH_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CROSS_BRANCH_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no puede operar en sedes distintas.`,
    });
  }
}

/**
 * Valida que el usuario tenga permiso para operar sobre una sede distinta a
 * la de su contexto de trabajo (IDOR por sede - Finding #2, PR#34).
 *
 * Un Fleet Operator autorizado para Sede A no puede gestionar vehiculos de
 * Sede B pasando assignedBranchId/filterBranchId de forma arbitraria.
 */
export function assertCrossBranchAllowed(
  role: WorkerRole | null,
  contextBranchId: string,
  targetBranchId: string | undefined | null,
): void {
  if (!targetBranchId || targetBranchId === contextBranchId) return;
  if (role === null || !CROSS_BRANCH_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CROSS_BRANCH_NOT_ALLOWED',
      detail: `El rol "${role ?? 'sin clave de sistema'}" no puede operar sobre una sede diferente a la del contexto de trabajo activo.`,
    });
  }
}
