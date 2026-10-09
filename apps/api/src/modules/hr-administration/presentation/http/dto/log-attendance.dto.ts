import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_ONLY_PATTERN } from './hr-date';

export class LogAttendanceDto {
  @Matches(DATE_ONLY_PATTERN, { message: 'date debe tener formato YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date!: string;

  @IsOptional()
  @IsISO8601()
  checkInTime?: string | null;

  @IsOptional()
  @IsISO8601()
  checkOutTime?: string | null;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minutesLate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deductionAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
