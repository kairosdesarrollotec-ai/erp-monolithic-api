import type { Prisma } from '@prisma/client';

export interface WorkContextAssignmentRecord {
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
}

export interface SelectWorkContextInput {
  firebaseUid: string;
  companyId: string;
  branchId: string;
}

/**
 * Puerto de lectura de las asignaciones empresa/sede de un usuario
 * (TR-05, BR-ORG-002). No hay escritura de asignaciones aqui - el alta de
 * asignaciones vive en ADM-01 (Usuarios y asignaciones), fuera de alcance
 * de HU-23.
 */
export abstract class WorkContextRepositoryPort {
  /**
   * Hallazgo alto de revision PR#4 ("las asignaciones 'vigentes' no
   * tienen vigencia"): solo devuelve asignaciones con `active = true` y
   * dentro de `[validFrom, validUntil)` - una asignacion revocada o
   * caducada nunca aparece aqui, aunque el registro siga existiendo en
   * la tabla (se conserva para historial/auditoria, no se borra).
   */
  abstract findAssignmentsByFirebaseUid(
    firebaseUid: string,
  ): Promise<WorkContextAssignmentRecord[]>;

  /**
   * Confirma que la combinacion companyId/branchId elegida por el usuario
   * sigue siendo una asignacion vigente para el (nunca se confia en lo que
   * el cliente envio sin cruzarlo contra la asignacion real,
   * SDD-KAIROS-TRANSVERSAL.md 14.3) y devuelve el organizationId de esa
   * asignacion para el evento de auditoria. null si no es una asignacion
   * valida y vigente del usuario.
   *
   * `tx` es opcional: cuando el llamador esta dentro de una transaccion
   * (ver TransactionManagerPort), se le pasa el mismo cliente para que la
   * lectura participe de esa transaccion en vez de abrir su propia
   * conexion.
   */
  abstract findValidAssignment(
    input: SelectWorkContextInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ organizationId: string } | null>;
}
