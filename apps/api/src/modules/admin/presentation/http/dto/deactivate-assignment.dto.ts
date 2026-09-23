import { IsUUID } from 'class-validator';

export class DeactivateAssignmentDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;
}
