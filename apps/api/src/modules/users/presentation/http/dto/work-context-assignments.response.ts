import type { WorkerRole } from '../../../domain/worker-role';

export class WorkContextAssignmentDto {
  companyId!: string;
  companyName!: string;
  branchId!: string;
  branchName!: string;
  role!: WorkerRole;
}

export class WorkContextAssignmentsResponse {
  assignments!: WorkContextAssignmentDto[];
}
