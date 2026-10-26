import type { VehicleOperationalFormatType } from '../../domain/vehicle-operational-format';

export interface RecordVehicleOperationalFormatCommand {
  firebaseUid: string;
  companyId: string;
  branchId: string;
  vehicleId: string;
  formatType: VehicleOperationalFormatType;
  processType?: string;
  processId?: string;
  odometerKm?: number;
  fuelLevelLines?: number;
  data: Record<string, unknown>;
  observations?: string;
  performedBy: string;
  performedAt?: Date;
}
