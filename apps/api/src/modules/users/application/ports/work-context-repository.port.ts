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
  abstract findAssignmentsByFirebaseUid(
    firebaseUid: string,
  ): Promise<WorkContextAssignmentRecord[]>;

  /**
   * Confirma que la combinacion companyId/branchId elegida por el usuario
   * sigue siendo una asignacion vigente para el (nunca se confia en lo que
   * el cliente envio sin cruzarlo contra la asignacion real,
   * SDD-KAIROS-TRANSVERSAL.md 14.3) y devuelve el organizationId de esa
   * asignacion para el evento de auditoria. null si no es una asignacion
   * valida del usuario.
   */
  abstract findValidAssignment(
    input: SelectWorkContextInput,
  ): Promise<{ organizationId: string } | null>;
}
