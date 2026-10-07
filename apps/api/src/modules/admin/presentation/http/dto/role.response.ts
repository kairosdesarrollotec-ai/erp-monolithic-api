import type { WorkerRole } from '../../../../users/domain/worker-role';

export class RoleResponse {
  id!: string;
  name!: string;
  key!: WorkerRole | null;
  isSystem!: boolean;
  active!: boolean;
  version!: number;
  assignmentCount!: number;
}

export class RolesResponse {
  roles!: RoleResponse[];
}
