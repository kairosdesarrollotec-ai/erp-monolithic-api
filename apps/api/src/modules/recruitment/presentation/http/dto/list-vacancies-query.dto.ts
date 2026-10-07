import { IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VacancyStatus } from '@prisma/client';

export class ListVacanciesQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsEnum(VacancyStatus)
  status?: VacancyStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  cursorCreatedAt?: string;

  @IsOptional()
  @IsUUID()
  cursorId?: string;
}
