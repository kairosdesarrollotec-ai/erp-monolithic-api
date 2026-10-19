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

  /** H-02: alias de `areaId` con el codigo del catalogo (se normaliza); si vienen ambos manda `areaCode`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  areaCode?: string;

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
