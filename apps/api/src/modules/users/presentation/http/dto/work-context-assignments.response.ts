import type { RoleRef } from '../../../domain/worker-role';

export class WorkContextAssignmentDto {
  companyId!: string;
  companyName!: string;
  branchId!: string;
  branchName!: string;
  role!: RoleRef;
}

export class WorkContextAssignmentsResponse {
  assignments!: WorkContextAssignmentDto[];
}
