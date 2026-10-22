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
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ATTENDANCE_EVIDENCE_KINDS } from '../../../application/commands/log-attendance.command';

export class MyAttendanceEvidenceDto {
  @IsOptional()
  @IsIn(ATTENDANCE_EVIDENCE_KINDS)
  kind?: (typeof ATTENDANCE_EVIDENCE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  storageRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

/** POST /me/attendance. La ubicacion es obligatoria en la marca propia (#9); se valida tambien en el handler (422). */
export class LogMyAttendanceDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsIn(['CHECK_IN', 'CHECK_OUT'])
  type?: 'CHECK_IN' | 'CHECK_OUT';

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutesLate?: number;

  @IsISO8601({ strict: true })
  capturedAt!: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  accuracy!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => MyAttendanceEvidenceDto)
  evidence?: MyAttendanceEvidenceDto | null;
}

export class MyAttendanceQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener formato YYYY-MM' })
  month?: string;
}

export class PendingReviewQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ReviewAttendanceDto {
  @IsIn(['APPROVE', 'CORRECT'])
  decision!: 'APPROVE' | 'CORRECT';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutesLate?: number;
}

export class SetBranchGeofenceDto {
  @IsUUID()
  companyId!: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusMeters!: number;
}

export class BranchGeofenceQueryDto {
  @IsUUID()
  companyId!: string;
}
