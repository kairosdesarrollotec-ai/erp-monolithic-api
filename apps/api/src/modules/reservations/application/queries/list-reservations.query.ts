import { ReservationStatus } from '../../domain/reservation-status';

export class ListReservationsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: ReservationStatus,
  ) {}
}
