export interface UserProfileRecord {
  id: string;
  organizationId: string;
  firebaseUid: string;
  requiresPasswordChange: boolean;
  mfaEnrolledAt: Date | null;
}

/**
 * Puerto de lectura/escritura del perfil minimo de "primer acceso"
 * (TR-02). Ver UserProfile en schema.prisma - modelo PROPUESTO.
 */
export abstract class UserProfileRepositoryPort {
  abstract findByFirebaseUid(firebaseUid: string): Promise<UserProfileRecord | null>;

  abstract completeActivation(firebaseUid: string): Promise<void>;
}
