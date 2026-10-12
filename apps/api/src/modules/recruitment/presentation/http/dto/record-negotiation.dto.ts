import { NegotiationOutcome } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RecordNegotiationDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsEnum(NegotiationOutcome)
  outcome!: NegotiationOutcome;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  offeredSalary!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  offeredSchedule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  offeredOtherConditions?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  candidateSalary?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  candidateSchedule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  candidateOtherConditions?: string;

  @IsOptional()
  @IsDateString()
  candidateStartDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  agreedSalary?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agreedConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
