import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ATTENDANCE_EVIDENCE_KINDS } from '../../../application/commands/log-attendance.command';
import { DATE_ONLY_PATTERN } from './hr-date';

/** DEC-ADP-ATT-EVIDENCE-001: foto con reloj+hora+rostro enviada al grupo de WhatsApp. */
export class AttendanceEvidenceDto {
  @IsIn(ATTENDANCE_EVIDENCE_KINDS)
  kind!: (typeof ATTENDANCE_EVIDENCE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  storageRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  /** YYYY-MM-DDTHH:mm[:ss] (hora de Lima) o ISO 8601 con offset/Z. */
  @IsISO8601()
  capturedAtLocal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceEvidenceDto)
  evidence?: AttendanceEvidenceDto | null;
}
