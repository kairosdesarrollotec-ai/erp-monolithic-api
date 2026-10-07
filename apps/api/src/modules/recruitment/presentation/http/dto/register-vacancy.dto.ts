import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { VacancySource } from '@prisma/client';

export class RegisterVacancyDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  department!: string;

  @IsEnum(VacancySource)
  source!: VacancySource;

  @IsOptional()
  @IsBoolean()
  isMechanic?: boolean;
}
