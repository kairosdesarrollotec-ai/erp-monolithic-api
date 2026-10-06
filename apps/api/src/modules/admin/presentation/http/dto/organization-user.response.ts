import type { RoleRef } from '../../../../users/domain/worker-role';

export class OrganizationUserResponse {
  id!: string;
  firebaseUid!: string;
  email!: string | null;
  companyId!: string;
  companyName!: string;
  branchId!: string;
  branchName!: string;
  role!: RoleRef;
  active!: boolean;
  mfaEnrolled!: boolean;
}

export class OrganizationUsersResponse {
  users!: OrganizationUserResponse[];
}
