import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHrAreaDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  /** Nombre visible del area; el `code` se deriva de el (mayusculas, sin tildes, `_`). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
