import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RETURN_REMINDER_RESULTS, ReturnReminderResult } from '../../../domain/return-reminder';

/** El recordatorio lo genera el sistema; el operador solo registra el resultado de su envío manual. */
export class RegisterReturnReminderDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(RETURN_REMINDER_RESULTS)
  result!: ReturnReminderResult;

  /** Hora real del envío (ISO-8601). Si se omite, el servidor usa la hora actual. */
  @IsOptional()
  @IsDateString()
  sentAt?: string;

  /** Obligatoria cuando result = FAILED (motivo). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
