export class UpdateVehicleCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly vehicleId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly brand?: string,
    public readonly model?: string,
    public readonly year?: number,
    public readonly color?: string,
    public readonly category?: string,
    public readonly dailyRate?: number,
    public readonly depositMinimum?: number,
    /** undefined = no cambia; null explicito = intento de vaciar => 400 PASSENGER_CAPACITY_REQUIRED. */
    public readonly passengerCapacity?: number | null,
    public readonly fuelPrice?: number,
    public readonly photoUrl?: string,
    public readonly assignedBranchId?: string,
    /** DEC-ALQ-THIRDPATH-001: undefined = no cambia. Cambiarlo exige FLEET.MANAGE_THIRD_PATH (Gerencia). */
    public readonly thirdPathEligible?: boolean,
    public readonly suitableForTrocha?: boolean,
    public readonly rateNormal?: number,
    public readonly ratePlus?: number,
    public readonly rateLibre?: number,
    public readonly fuelPenaltyPerLine?: number,
  ) {}
}
