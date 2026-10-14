import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { RESERVATION_CANCEL_REASONS, ReservationCancelReason } from '../../../domain/reservation-cancel-reason';

export class CancelReservationDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  @IsIn(RESERVATION_CANCEL_REASONS)
  reason!: ReservationCancelReason;

  @IsOptional() @IsString() note?: string;
}
