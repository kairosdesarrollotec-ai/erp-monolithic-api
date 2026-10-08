export interface InterviewerCandidateAssignee {
  firebaseUid: string;
  roleId: string;
}

/**
 * Puerto de lectura del buscador de entrevistadores (REC-05).
 * Separa "quien esta asignado vigente a la empresa" (BD) de "como se llama"
 * (proveedor de identidad); el filtro por permiso lo aplica el handler con la
 * matriz dinamica ADM-02 (no se duplica logica de roles aqui).
 */
export abstract class InterviewerDirectoryPort {
  /**
   * Asignaciones VIGENTES (active, dentro de [validFrom, validUntil), rol activo)
   * de la empresa indicada dentro de la organizacion. Una fila por (usuario, rol);
   * un usuario con varias sedes puede repetirse.
   */
  abstract listActiveAssignees(
    scope: { organizationId: string; operatingCompanyId: string },
    now: Date,
  ): Promise<InterviewerCandidateAssignee[]>;

  /**
   * Nombre visible de cada uid. `null` si el proveedor no tiene nombre para ese
   * usuario o la cuenta ya no existe. Nunca devuelve correo ni telefono.
   */
  abstract findDisplayNames(uids: string[]): Promise<Record<string, string | null>>;
}
