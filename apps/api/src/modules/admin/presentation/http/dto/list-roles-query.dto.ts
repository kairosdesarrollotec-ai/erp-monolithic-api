import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListRolesQueryDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Query string: 'true' | 'false' (default false = solo roles activos). */
  @IsOptional() @IsIn(['true', 'false']) includeInactive?: string;
}
