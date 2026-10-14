import type { ReservationCancelReason } from '../../domain/reservation-cancel-reason';

export class CancelReservationCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly reason: ReservationCancelReason,
    public readonly note?: string,
  ) {}
}
