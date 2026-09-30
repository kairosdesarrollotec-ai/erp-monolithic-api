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

export function assertFleetWrite(role: WorkerRole): void {
  if (!FLEET_WRITE_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'FLEET_WRITE_NOT_ALLOWED',
      detail: `El rol "${role}" no tiene permiso para modificar la flota de vehículos.`,
    });
  }
}

export function assertFleetRead(role: WorkerRole): void {
  if (!FLEET_READ_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'FLEET_READ_NOT_ALLOWED',
      detail: `El rol "${role}" no tiene permiso para consultar la flota de vehículos.`,
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
  role: WorkerRole,
  contextBranchId: string,
  targetBranchId: string | undefined | null,
): void {
  if (!targetBranchId || targetBranchId === contextBranchId) return;
  if (!CROSS_BRANCH_ROLES.has(role)) {
    throw new ForbiddenException({
      code: 'CROSS_BRANCH_NOT_ALLOWED',
      detail: `El rol "${role}" no puede operar sobre una sede diferente a la del contexto de trabajo activo.`,
    });
  }
}
