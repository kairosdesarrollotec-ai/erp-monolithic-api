export type VehicleStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface FleetVehicle {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId?: string | null;
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  category?: string | null;
  status: VehicleStatus;
  dailyRate?: number | null;
  depositMinimum?: number | null;
  photoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
