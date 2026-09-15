import { Injectable } from '@nestjs/common';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';
import { GetActivationStatusQuery } from './get-activation-status.query';
import type { ActivationStatus } from '../../domain/activation-status';

/**
 * TR-02: determina si el usuario autenticado debe pasar por la pantalla
 * de activacion (paso 1 cambio de contrasena, paso 2 enrolamiento MFA)
 * antes de llegar al tablero (TR-06).
 *
 * Si el usuario todavia no tiene UserProfile (p.ej. cuentas creadas
 * antes de este modelo), se asume que NO requiere activacion - evita
 * bloquear a usuarios existentes por un modelo nuevo.
 */
@Injectable()
export class GetActivationStatusHandler {
  constructor(private readonly repository: UserProfileRepositoryPort) {}

  async execute(query: GetActivationStatusQuery): Promise<ActivationStatus> {
    const profile = await this.repository.findByFirebaseUid(query.firebaseUid);

    if (!profile) {
      return { requiresPasswordChange: false, requiresMfaEnrollment: false };
    }

    return {
      requiresPasswordChange: profile.requiresPasswordChange,
      requiresMfaEnrollment: profile.mfaEnrolledAt === null,
    };
  }
}
