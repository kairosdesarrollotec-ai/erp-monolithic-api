import { IsString, IsUUID } from 'class-validator';

export class RenameRoleDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsString() name!: string;
}
