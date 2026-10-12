import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterCandidateDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(30)
  documentNumber!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  /** Obsoleto: el CV se sube despues con la sesion de subida del candidato; si falta, el servidor asigna un codigo. */
  @IsOptional()
  @IsUUID()
  cvDocumentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryExpectation?: number;
}
