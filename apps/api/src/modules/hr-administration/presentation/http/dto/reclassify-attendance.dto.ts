import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const RECLASSIFY_ATTENDANCE_STATUSES = ['FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA'] as const;

export class ReclassifyAttendanceDto {
  @IsIn(RECLASSIFY_ATTENDANCE_STATUSES)
  status!: (typeof RECLASSIFY_ATTENDANCE_STATUSES)[number];

  /** Justificación o motivo del cambio (obligatorio). */
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  justification!: string;
}
