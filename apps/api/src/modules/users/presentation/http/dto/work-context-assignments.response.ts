export class WorkContextAssignmentDto {
  companyId!: string;
  companyName!: string;
  branchId!: string;
  branchName!: string;
}

export class WorkContextAssignmentsResponse {
  assignments!: WorkContextAssignmentDto[];
}
