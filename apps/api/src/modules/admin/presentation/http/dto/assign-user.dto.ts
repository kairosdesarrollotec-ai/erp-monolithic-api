import { IsEmail, IsIn, IsUUID } from 'class-validator';
import { WORKER_ROLES, WorkerRole } from '../../../../users/domain/worker-role';

export class AssignUserDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsEmail()
  targetEmail!: string;

  @IsUUID()
  targetCompanyId!: string;

  @IsUUID()
  targetBranchId!: string;

  @IsIn(WORKER_ROLES)
  targetRole!: WorkerRole;
}
