import type { Prisma } from '@prisma/client';
import type { WorkerRole } from '../../../users/domain/worker-role';

export interface AdminAssignmentRecord {
  id: string;
  firebaseUid: string;
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  role: WorkerRole;
  active: boolean;
  mfaEnrolledAt: Date | null;
}

export interface CreateOrReactivateAssignmentInput {
  organizationId: string;
  firebaseUid: string;
  companyId: string;
  branchId: string;
  role: WorkerRole;
}

export interface CompanyBranchOwnership {
  companyId: string;
  branchId: string;
}

export interface CompanyWithBranches {
  companyId: string;
  companyName: string;
  branches: { branchId: string; branchName: string }[];
}

/**
 * Puerto de persistencia de ADM-01 (Usuarios y asignaciones,
 * PANTALLAS-V2-B-SOPORTE.md). Reutiliza `user_company_assignments` (la
 * misma tabla de TR-05/BR-ORG-002) - ADM-01 es la pantalla de escritura
 * que esa tabla no tenia todavia (WorkContextRepositoryPort es de solo
 * lectura, ver su nota "el alta de asignaciones vive en ADM-01").
 */
export abstract class AdminUserRepositoryPort {
  /**
   * Todos los usuarios de la organizacion (activos e inactivos - "dar de
   * baja" en el contrato de ADM-01 es reversible, no un borrado, para
   * conservar el historial de auditoria).
   */
  abstract listAssignmentsByOrganization(organizationId: string): Promise<AdminAssignmentRecord[]>;

  /**
   * Confirma que companyId/branchId pertenecen realmente a la
   * organizacion del admin (hallazgo de patron ya establecido en este
   * repo, "IDOR entre sedes/empresas") - nunca se confia en el
   * companyId/branchId del body sin cruzarlo contra la base.
   */
  abstract findCompanyBranchOwnership(
    organizationId: string,
    companyId: string,
    branchId: string,
  ): Promise<CompanyBranchOwnership | null>;

  /**
   * Alta o reactivacion (upsert por la clave unica
   * (firebaseUid, companyId, branchId) ya existente en el modelo) - dar
   * de baja y volver a asignar no crea una fila duplicada, reactiva la
   * misma con el rol indicado.
   */
  abstract createOrReactivateAssignment(
    input: CreateOrReactivateAssignmentInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }>;

  /**
   * "Dar de baja" (ADM-01, punto 10 del contrato: requiere confirmacion).
   * Nunca borra la fila - pone `active=false`, conservando el historial.
   * Devuelve `false` si el id no existe o no pertenece a la organizacion
   * del admin (IDOR).
   */
  abstract deactivateAssignment(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ firebaseUid: string; role: WorkerRole } | null>;

  /**
   * Cuenta las asignaciones activas con el rol dado en la organizacion
   * (hallazgo ALTO de revalidacion PR#7, "ultimo administrador"): antes
   * de dar de baja una asignacion ADMINISTRACION hay que saber si es la
   * unica que queda, para no dejar la organizacion sin nadie que pueda
   * gestionar usuarios/permisos. Debe leerse dentro de la misma
   * transaccion Serializable que la baja, para evitar la carrera de dos
   * bajas concurrentes dejando 0 administradores.
   */
  abstract countActiveByRole(
    organizationId: string,
    role: WorkerRole,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;

  /**
   * Empresas y sedes de la organizacion (GET /admin/companies) - para
   * poblar el selector Empresa/Sede de "Agregar usuario" con el grupo
   * completo, no solo el contexto de trabajo actual del admin.
   */
  abstract listCompaniesWithBranches(organizationId: string): Promise<CompanyWithBranches[]>;
}
