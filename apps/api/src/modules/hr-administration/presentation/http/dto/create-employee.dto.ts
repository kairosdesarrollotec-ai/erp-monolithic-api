import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class CreateEmployeeDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  /** H-02: codigo del catalogo de areas (GET /hr-areas). Si viene, `areaId`/`areaName` se ignoran. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaCode?: string;

  /** Compatibilidad (texto libre): opcional; se deriva del nombre. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  areaId?: string;

  /** Compatibilidad (texto libre): obligatorio solo si no se envia `areaCode`. */
  @ValidateIf((o: CreateEmployeeDto) => !o.areaCode)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  jobTitle!: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'hireDate debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  hireDate!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary?: number | null;
}
