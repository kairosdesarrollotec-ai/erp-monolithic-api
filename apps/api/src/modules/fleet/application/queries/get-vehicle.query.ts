export class GetVehicleQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly vehicleId: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
