import { LeaveType } from '@prisma/client';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class RequestLeaveDto {
  @IsEnum(LeaveType)
  type!: LeaveType;

  @Matches(DATE_ONLY_PATTERN, { message: 'date debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date!: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string | null;

  @IsOptional()
  @IsISO8601()
  endTime?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
