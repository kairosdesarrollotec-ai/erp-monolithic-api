import { TerminationReason } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TerminateEmploymentDto {
  @IsEnum(TerminationReason)
  reason!: TerminationReason;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  noticeDays?: number;

  @IsBoolean()
  finalSettlementPaid!: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  settlementAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
