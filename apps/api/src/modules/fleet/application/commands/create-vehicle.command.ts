import { VehicleStatus } from '../../domain/vehicle';

export class CreateVehicleCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly plate: string,
    public readonly brand: string,
    public readonly model: string,
    /** Obligatoria en el alta: null/undefined => 400 PASSENGER_CAPACITY_REQUIRED (DEC-FLT-CAP-001). */
    public readonly passengerCapacity: number | null | undefined,
    public readonly year?: number,
    public readonly color?: string,
    public readonly category?: string,
    public readonly status?: VehicleStatus,
    public readonly dailyRate?: number,
    public readonly photoUrl?: string,
    public readonly assignedBranchId?: string,
    public readonly depositMinimum?: number,
    public readonly fuelPrice?: number,
    public readonly suitableForTrocha?: boolean,
    public readonly rateNormal?: number,
    public readonly ratePlus?: number,
    public readonly rateLibre?: number,
    public readonly fuelPenaltyPerLine?: number,
  ) {}
}
