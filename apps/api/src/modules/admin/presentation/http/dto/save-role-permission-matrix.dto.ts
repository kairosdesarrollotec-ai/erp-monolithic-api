import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { PERMISSION_MODULES, type PermissionModule } from '../../../domain/permission-action-catalog';

export class RolePermissionEntryDto {
  @IsUUID() roleId!: string;
  @IsIn(PERMISSION_MODULES) module!: PermissionModule;
  @IsString() action!: string;
  @IsBoolean() allowed!: boolean;
}

export class SaveRolePermissionMatrixDto {
  /** Contexto de trabajo del admin. */
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Ambito de la nueva version; omitido/null = toda la organizacion. */
  @IsOptional() @IsUUID() scopeCompanyId?: string | null;
  @IsOptional() @IsUUID() scopeBranchId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  entries!: RolePermissionEntryDto[];
}
