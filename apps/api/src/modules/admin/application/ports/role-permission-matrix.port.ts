import type { Prisma } from '@prisma/client';
import type { PermissionModule } from '../../domain/permission-action-catalog';

/**
 * Ambito de una version de la matriz: `companyId`/`branchId` null = toda la
 * organizacion; `companyId` solo = toda la empresa; ambos = esa sede.
 */
export interface MatrixScope {
  companyId: string | null;
  branchId: string | null;
}

export const ORGANIZATION_SCOPE: MatrixScope = { companyId: null, branchId: null };

export interface RolePermissionEntry {
  roleId: string;
  module: PermissionModule;
  action: string;
  allowed: boolean;
}

export interface RolePermissionMatrixSnapshot {
  version: number;
  scope: MatrixScope;
  entries: RolePermissionEntry[];
}

/**
 * ADM-02 (Roles y permisos, PANTALLAS-V2-B-SOPORTE.md) - matriz
 * rol-accion VERSIONADA (de solo insercion) y con ambito.
 *
 * ROLES DINAMICOS (fase 2): las celdas se identifican por `roleId` (tabla
 * `roles`); ya no por el enum WorkerRole. La matriz es hoy la fuente de
 * enforcement de Reservas, Consultas, Alquileres, Incidencias y las 5
 * acciones de Administracion (MatrixAuthorizationService). Devoluciones,
 * Clientes y Flota siguen con sets hard-coded por `roleKey` (fase 4).
 *
 * Resolucion: gana el ambito mas especifico (sede > empresa > organizacion);
 * sin entrada = denegado. La numeracion de `version` es unica por
 * organizacion (compartida entre ambitos).
 */
export abstract class RolePermissionMatrixPort {
  /**
   * Capas VIGENTES que aplican a un contexto, de la mas especifica a la
   * menos: [sede?, empresa?, organizacion]. La capa de organizacion siempre
   * esta (si la organizacion nunca guardo una version propia es la version 0
   * implicita, derivada de los `*-role-policy.ts` y mapeada key -> role_id).
   * `scope` omitido = solo la capa de organizacion. `roleId` opcional filtra
   * las entradas de ese rol (camino caliente de assertAllowed).
   */
  abstract getLayers(
    organizationId: string,
    scope?: { companyId: string; branchId: string | null },
    options?: { roleId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot[]>;

  /**
   * La foto vigente de un ambito para MOSTRAR en ADM-02: si ese ambito tiene
   * version propia la devuelve; si no, hereda la capa mas especifica de
   * arriba (empresa -> organizacion -> v0). `snapshot.scope` dice de donde sale.
   */
  abstract getCurrentVersion(
    organizationId: string,
    scope?: MatrixScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot>;

  /** Todas las fotos vigentes de la organizacion (una por ambito con version propia + la de organizacion/v0). */
  abstract getAllCurrentSnapshots(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot[]>;

  abstract saveNewVersion(
    organizationId: string,
    entries: RolePermissionEntry[],
    createdBy: string,
    scope: MatrixScope,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot>;
}
