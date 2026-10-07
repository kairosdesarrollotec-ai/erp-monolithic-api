import { IsUUID } from 'class-validator';

export class DeactivateRoleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
