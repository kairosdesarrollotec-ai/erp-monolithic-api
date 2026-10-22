/**
 * DEC-ALQ-VEHDATA-001 (Respuestas de Russbel 2026-10-20 #5; extiende DEC-ALQ-CAPWARN-001): la capacidad de pasajeros, la
 * garantia (depositMinimum) y el precio del combustible se piden al registrar el vehiculo pero siguen siendo opcionales en
 * la API. Al crear una reserva o un alquiler (y al leerlos) de un vehiculo al que le falte alguno, la respuesta lleva un
 * aviso estructurado por cada dato faltante para que el front pida completarlo en Flota. NO bloquea.
 */
export type VehicleDataWarningCode =
  | 'VEHICLE_PASSENGER_CAPACITY_MISSING'
  | 'VEHICLE_DEPOSIT_MINIMUM_MISSING'
  | 'VEHICLE_FUEL_PRICE_MISSING';

export interface VehicleDataWarning {
  code: VehicleDataWarningCode;
  /** Campo del vehiculo en Flota (PATCH /fleet/vehicles/{id}). */
  field: 'passengerCapacity' | 'depositMinimum' | 'fuelPrice';
  message: string;
}

export interface VehicleDataSnapshot {
  passengerCapacity?: number | null;
  depositMinimum?: number | null;
  fuelPrice?: number | null;
}

export function buildVehicleDataWarnings(vehicle: VehicleDataSnapshot): VehicleDataWarning[] {
  const warnings: VehicleDataWarning[] = [];
  if (vehicle.passengerCapacity == null || vehicle.passengerCapacity <= 0) {
    warnings.push({
      code: 'VEHICLE_PASSENGER_CAPACITY_MISSING',
      field: 'passengerCapacity',
      message: 'El vehiculo no tiene capacidad de pasajeros registrada. Completela en Flota (Editar vehiculo).',
    });
  }
  if (vehicle.depositMinimum == null) {
    warnings.push({
      code: 'VEHICLE_DEPOSIT_MINIMUM_MISSING',
      field: 'depositMinimum',
      message: 'El vehiculo no tiene garantia registrada. Completela en Flota (Editar vehiculo).',
    });
  }
  if (vehicle.fuelPrice == null) {
    warnings.push({
      code: 'VEHICLE_FUEL_PRICE_MISSING',
      field: 'fuelPrice',
      message: 'El vehiculo no tiene precio de combustible registrado. Completelo en Flota (Editar vehiculo).',
    });
  }
  return warnings;
}
