import type { Prisma } from '@prisma/client';
import type { WorkerRole } from '../../../users/domain/worker-role';

export interface RolePermissionEntry {
  role: WorkerRole;
  module: 'RESERVATION' | 'INQUIRY' | 'ADMIN';
  action: string;
  allowed: boolean;
}

export interface RolePermissionMatrixSnapshot {
  version: number;
  entries: RolePermissionEntry[];
}

/**
 * ADM-02 (Roles y permisos, PANTALLAS-V2-B-SOPORTE.md). Ver la nota de
 * alcance real en el modelo Prisma (RolePermissionMatrixVersion): esta
 * matriz es hoy de visualizacion/auditoria, no reemplaza el enforcement
 * de los `*-role-policy.ts` existentes.
 */
export abstract class RolePermissionMatrixPort {
  /**
   * Version vigente para la organizacion. Si todavia no existe ninguna
   * (nunca se uso ADM-02 para guardar), la version 0 se construye
   * reflejando el estado REAL de los `*-role-policy.ts` existentes
   * (ver default-role-permission-matrix.ts) - la primera vez que un
   * admin abre ADM-02 ve lo que el sistema ya hace hoy, no una matriz
   * vacia sin sentido.
   */
  abstract getCurrentVersion(organizationId: string): Promise<RolePermissionMatrixSnapshot>;

  abstract saveNewVersion(
    organizationId: string,
    entries: RolePermissionEntry[],
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermissionMatrixSnapshot>;
}
