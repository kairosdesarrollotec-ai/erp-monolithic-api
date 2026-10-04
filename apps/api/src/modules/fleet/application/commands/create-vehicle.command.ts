import { VehicleStatus } from '../../domain/vehicle';

export class CreateVehicleCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly plate: string,
    public readonly brand: string,
    public readonly model: string,
    public readonly year?: number,
    public readonly color?: string,
    public readonly category?: string,
    public readonly status?: VehicleStatus,
    public readonly dailyRate?: number,
    public readonly depositMinimum?: number,
    public readonly photoUrl?: string,
    public readonly assignedBranchId?: string,
  ) {}
}
