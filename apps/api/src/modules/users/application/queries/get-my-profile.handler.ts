import { Injectable } from '@nestjs/common';
import { UserProfileRepositoryPort } from '../ports/user-profile-repository.port';
import { WorkContextRepositoryPort } from '../ports/work-context-repository.port';
import { GetMyProfileQuery } from './get-my-profile.query';
import type { UserProfileResponse } from '../../presentation/http/dto/user-profile.response';

/**
 * TR-09: obtiene el perfil consolidado del usuario autenticado (perfil de primer
 * acceso, estado de activacion, MFA y asignaciones vigentes de empresa/sede).
 */
@Injectable()
export class GetMyProfileHandler {
  constructor(
    private readonly userProfileRepo: UserProfileRepositoryPort,
    private readonly workContextRepo: WorkContextRepositoryPort,
  ) {}

  async execute(query: GetMyProfileQuery): Promise<UserProfileResponse> {
    const profile = await this.userProfileRepo.findByFirebaseUid(query.firebaseUid);
    const assignments = await this.workContextRepo.findAssignmentsByFirebaseUid(query.firebaseUid);

    const organizationId =
      profile?.organizationId ?? assignments[0]?.organizationId ?? '';

    const requiresPasswordChange = profile ? profile.requiresPasswordChange : false;
    const mfaEnrolled = profile ? profile.mfaEnrolledAt !== null : false;
    const mfaEnrolledAt = profile?.mfaEnrolledAt
      ? profile.mfaEnrolledAt instanceof Date
        ? profile.mfaEnrolledAt.toISOString()
        : new Date(profile.mfaEnrolledAt).toISOString()
      : null;

    return {
      firebaseUid: query.firebaseUid,
      email: query.email ?? null,
      displayName: query.displayName ?? null,
      organizationId,
      requiresPasswordChange,
      mfaEnrolled,
      mfaEnrolledAt,
      assignments,
    };
  }
}
