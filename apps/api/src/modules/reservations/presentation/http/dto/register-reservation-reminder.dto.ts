import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RESERVATION_REMINDER_RESULTS, ReservationReminderResult } from '../../../domain/reservation-reminder';

export class RegisterReservationReminderDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  branchId!: string;

  @IsIn(RESERVATION_REMINDER_RESULTS)
  result!: ReservationReminderResult;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
