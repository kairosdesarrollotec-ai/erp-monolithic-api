import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class VacationsCalendarQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  areaId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
