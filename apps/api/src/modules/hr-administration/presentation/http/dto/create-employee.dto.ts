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

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaName!: string;

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
