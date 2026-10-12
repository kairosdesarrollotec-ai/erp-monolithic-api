import { FleetVehicle, VehicleConflictSource, VehicleStatus } from '../../domain/vehicle';

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
  depositMinimum?: number | null;
  photoUrl?: string | null;
}

export interface UpdateVehicleInput {
  branchId?: string | null;
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  category?: string | null;
  dailyRate?: number | null;
  depositMinimum?: number | null;
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

export interface VehicleWindowConflict {
  vehicleId: string;
  from: Date;
  to: Date;
  source: VehicleConflictSource;
}

export abstract class FleetVehicleRepositoryPort {
  /**
   * Primer conflicto por vehiculo en [from, to) (commitments ACTIVE|CONSOLIDATED
   * y reservas no terminales), en lote: una query por fuente. Los vehiculos
   * libres no aparecen en el mapa.
   */
  abstract findConflicts(
    vehicleIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<Map<string, VehicleWindowConflict>>;
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
  abstract update(
    id: string,
    scope: { organizationId: string; operatingCompanyId: string },
    input: UpdateVehicleInput,
  ): Promise<FleetVehicle>;
}
