import { FleetVehicle } from '../../domain/vehicle';
import { VehicleResponse } from './dto/vehicle.response';

export function toVehicleResponse(vehicle: FleetVehicle): VehicleResponse {
  return {
    id: vehicle.id,
    organizationId: vehicle.organizationId,
    operatingCompanyId: vehicle.operatingCompanyId,
    branchId: vehicle.branchId ?? null,
    plate: vehicle.plate,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year ?? null,
    color: vehicle.color ?? null,
    category: vehicle.category ?? null,
    status: vehicle.status,
    dailyRate: vehicle.dailyRate ?? null,
    photoUrl: vehicle.photoUrl ?? null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}
