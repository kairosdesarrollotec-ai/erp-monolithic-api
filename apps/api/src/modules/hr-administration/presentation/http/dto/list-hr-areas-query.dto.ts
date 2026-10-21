import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ListHrAreasQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  /** Incluye areas desactivadas. Solo Gerencia (HR_ADMINISTRATION.MANAGE_AREAS); 403 para los demas. */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value))
  @IsBoolean()
  includeInactive?: boolean;
}
