import { VehicleStatus } from '../../../domain/vehicle';

export interface VehicleResponse {
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
  createdAt: string;
  updatedAt: string;
}

export interface ListVehiclesResponse {
  items: VehicleResponse[];
  total: number;
}
