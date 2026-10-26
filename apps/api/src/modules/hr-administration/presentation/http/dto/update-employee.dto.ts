import { EmployeeStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName?: string;

  /** Vaciar el correo ("" o null) DESVINCULA la ficha de su cuenta sin error (Respuestas 2026-10-20 #19). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  /** H-02: codigo del catalogo de areas (GET /hr-areas); manda sobre `areaId`/`areaName`. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaCode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  jobTitle?: string;

  /** Solo Gerencia puede cambiarlo (HR_ADMINISTRATION.MANAGE_SALARY); otro rol con un valor distinto -> 403 EMPLOYEE_SALARY_GERENCIA_ONLY. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  baseSalary?: number | null;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsBoolean()
  probationPassed?: boolean | null;

  @IsOptional()
  @IsISO8601()
  payrollStartedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankAccountCci?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contractType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractUrl?: string | null;

  @IsOptional()
  @IsString()
  contractNotes?: string | null;
}
