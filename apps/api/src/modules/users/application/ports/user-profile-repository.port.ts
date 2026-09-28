export interface UserProfileRecord {
  id: string;
  organizationId: string;
  firebaseUid: string;
  requiresPasswordChange: boolean;
  mfaEnrolledAt: Date | null;
}

export interface CreateProfileInput {
  firebaseUid: string;
  organizationId: string;
  requiresPasswordChange?: boolean;
}

/**
 * Puerto de lectura/escritura del perfil minimo de "primer acceso"
 * (TR-02). Ver UserProfile en schema.prisma - modelo PROPUESTO.
 */
export abstract class UserProfileRepositoryPort {
  abstract findByFirebaseUid(firebaseUid: string): Promise<UserProfileRecord | null>;

  /**
   * Crea el perfil de primer acceso para un usuario recien provisionado
   * via ADM-01 (requiresPasswordChange: false, mfaEnrolledAt: null).
   * Usa upsert para ser idempotente frente a reintentos.
   */
  abstract createProfile(input: CreateProfileInput): Promise<void>;

  abstract completeActivation(firebaseUid: string): Promise<void>;
}
