import type { WorkContextAssignmentRecord } from '../../../application/ports/work-context-repository.port';

export class UserProfileResponse {
  firebaseUid!: string;
  email!: string | null;
  displayName!: string | null;
  organizationId!: string;
  requiresPasswordChange!: boolean;
  mfaEnrolled!: boolean;
  mfaEnrolledAt!: string | null;
  assignments!: WorkContextAssignmentRecord[];
}
