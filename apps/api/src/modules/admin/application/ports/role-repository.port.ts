import type { Prisma } from '@prisma/client';
import type { WorkerRole } from '../../../users/domain/worker-role';

export interface RoleRecord {
  id: string;
  organizationId: string;
  /** Clave estable de los roles de sistema; null en roles creados a mano. */
  key: WorkerRole | null;
  name: string;
  isSystem: boolean;
  active: boolean;
  /** Concurrencia optimista (ETag / If-Match) de renombrar y desactivar. */
  version: number;
}

export interface RoleWithAssignmentCount extends RoleRecord {
  /** Asignaciones activas (active = true) con este rol. */
  assignmentCount: number;
}

/**
 * Puerto de persistencia de los roles dinamicos (ADM-02). TODA lectura/
 * escritura va acotada por `organizationId`: un id de otra organizacion se
 * comporta como inexistente (IDOR -> el handler responde 404).
 */
export abstract class RoleRepositoryPort {
  abstract listByOrganization(
    organizationId: string,
    options: { includeInactive: boolean },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleWithAssignmentCount[]>;

  abstract findById(id: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<RoleRecord | null>;

  /** Roles ACTIVOS de la organizacion (completitud de la matriz: roles activos x catalogo). */
  abstract listActive(organizationId: string, tx?: Prisma.TransactionClient): Promise<RoleRecord[]>;

  /** Crea un rol NO de sistema, activo, version 1. 409 ROLE_NAME_TAKEN si el nombre ya existe (sin distinguir mayusculas). */
  abstract create(input: { organizationId: string; name: string }, tx?: Prisma.TransactionClient): Promise<RoleRecord>;

  /**
   * Renombra con control optimista: devuelve null si `expectedVersion` ya no
   * coincide (el handler responde 412). 409 ROLE_NAME_TAKEN si el nombre choca.
   */
  abstract rename(
    input: { id: string; organizationId: string; expectedVersion: number; name: string },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleRecord | null>;

  /** Desactiva con control optimista (null = version desactualizada). Nunca borra. */
  abstract deactivate(
    input: { id: string; organizationId: string; expectedVersion: number },
    tx?: Prisma.TransactionClient,
  ): Promise<RoleRecord | null>;

  abstract countActiveAssignments(roleId: string, organizationId: string, tx?: Prisma.TransactionClient): Promise<number>;
}
