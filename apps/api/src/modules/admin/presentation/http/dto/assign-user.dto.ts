import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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

  @IsUUID()
  targetRoleId!: string;

  /**
   * Solo obligatoria si el backend determina que el correo es nuevo en
   * Firebase (ver AssignUserToCompanyHandler) - para un correo ya
   * existente el handler la ignora aunque se envie.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  initialPassword?: string;
}
