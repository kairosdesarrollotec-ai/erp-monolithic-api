import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';
import { RESERVATION_CANCEL_REASONS, ReservationCancelReason } from '../../../domain/reservation-cancel-reason';

export class CancelReservationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(RESERVATION_CANCEL_REASONS)
  reason!: ReservationCancelReason;

  /** CR-06: motivo escrito obligatorio (min. 5 caracteres). */
  @IsString() @MinLength(5) note!: string;
}
