import { FleetVehicle, VehicleStatus } from '../../domain/vehicle';

export interface CreateVehicleInput {
  organizationId: string;
  operatingCompanyId: string;
  branchId?: string | null;
  plate: string;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  category?: string | null;
  status?: VehicleStatus;
  dailyRate?: number | null;
  photoUrl?: string | null;
}

export interface ListVehiclesFilters {
  organizationId: string;
  operatingCompanyId: string;
  branchId?: string;
  status?: VehicleStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export abstract class FleetVehicleRepositoryPort {
  abstract create(input: CreateVehicleInput): Promise<FleetVehicle>;
  abstract findById(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
  ): Promise<FleetVehicle | null>;
  abstract findByPlate(plate: string): Promise<FleetVehicle | null>;
  abstract list(
    filters: ListVehiclesFilters,
  ): Promise<{ items: FleetVehicle[]; total: number }>;
  abstract updateStatus(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    status: VehicleStatus,
  ): Promise<FleetVehicle>;
}
