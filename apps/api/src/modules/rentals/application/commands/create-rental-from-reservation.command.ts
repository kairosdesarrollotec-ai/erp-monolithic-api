export class CreateRentalFromReservationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly reservationId: string,
    public readonly planCode?: string,
  ) {}
}
