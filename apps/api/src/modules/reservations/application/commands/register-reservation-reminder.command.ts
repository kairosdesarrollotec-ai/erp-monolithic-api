import { ReservationReminderResult } from '../../domain/reservation-reminder';

export class RegisterReservationReminderCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly result: ReservationReminderResult,
    public readonly sentAt?: Date,
    public readonly note?: string,
  ) {}
}
