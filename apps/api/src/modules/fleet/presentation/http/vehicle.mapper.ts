import { FleetVehicle, FleetVehicleWithAvailability, VehicleAvailability } from '../../domain/vehicle';
import { VehicleAvailabilityResponse, VehicleResponse } from './dto/vehicle.response';

export function toAvailabilityResponse(availability: VehicleAvailability): VehicleAvailabilityResponse {
  if (availability.available) return { available: true };
  return {
    available: false,
    conflictFrom: availability.conflictFrom?.toISOString(),
    conflictTo: availability.conflictTo?.toISOString(),
    conflictSource: availability.conflictSource,
  };
}

export function toVehicleResponse(vehicle: FleetVehicle | FleetVehicleWithAvailability): VehicleResponse {
  const availability = 'availability' in vehicle ? vehicle.availability : undefined;
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
    depositMinimum: vehicle.depositMinimum ?? null,
    passengerCapacity: vehicle.passengerCapacity ?? null,
    fuelPrice: vehicle.fuelPrice ?? null,
    photoUrl: vehicle.photoUrl ?? null,
    thirdPathEligible: vehicle.thirdPathEligible ?? false,
    suitableForTrocha: vehicle.suitableForTrocha ?? false,
    rateNormal: vehicle.rateNormal ?? null,
    ratePlus: vehicle.ratePlus ?? null,
    rateLibre: vehicle.rateLibre ?? null,
    fuelPenaltyPerLine: vehicle.fuelPenaltyPerLine ?? null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    ...(availability ? { availability: toAvailabilityResponse(availability) } : {}),
  };
}
