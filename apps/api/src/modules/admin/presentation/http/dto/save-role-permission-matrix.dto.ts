import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsString, IsUUID, ValidateNested } from 'class-validator';
import { WORKER_ROLES, WorkerRole } from '../../../../users/domain/worker-role';

export class RolePermissionEntryDto {
  @IsIn(WORKER_ROLES) role!: WorkerRole;
  @IsIn(['RESERVATION', 'INQUIRY', 'ADMIN', 'RENTAL']) module!: 'RESERVATION' | 'INQUIRY' | 'ADMIN' | 'RENTAL';
  @IsString() action!: string;
  @IsBoolean() allowed!: boolean;
}

export class SaveRolePermissionMatrixDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  entries!: RolePermissionEntryDto[];
}
