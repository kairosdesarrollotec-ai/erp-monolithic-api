import { VehicleStatus } from '../../domain/vehicle';

export class UpdateVehicleStatusCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly vehicleId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status: VehicleStatus,
  ) {}
}
