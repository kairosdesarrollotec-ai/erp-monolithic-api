import { IsUUID } from 'class-validator';

export class GetRolePermissionMatrixQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
}
