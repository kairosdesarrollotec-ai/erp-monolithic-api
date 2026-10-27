import { DomainBadRequestError, DomainConflictError, DomainUnprocessableError } from '../../../common/domain/domain-errors';

export class VehiclePlateAlreadyExistsError extends DomainConflictError {
  readonly code = 'VEHICLE_PLATE_ALREADY_EXISTS';

  constructor(plate: string) {
    super(`Ya existe un vehículo registrado con la placa ${plate}.`);
  }
}

/**
 * HU-15 / SDD §12.1: Bloqueo de puesta fuera de servicio (baja) de vehículo con contrato/reserva activa o compromiso vigente.
 */
export class VehicleHasActiveCommitmentError extends DomainUnprocessableError {
  readonly code = 'VEHICLE_HAS_ACTIVE_COMMITMENT';

  constructor(detail?: string) {
    super(detail ?? 'No se puede poner fuera de servicio el vehículo: tiene alquileres activos, reservas confirmadas o compromisos vigentes.');
  }
}

/**
 * DEC-FLT-CAP-001 (G-05): la capacidad de pasajeros es obligatoria al registrar un vehiculo y no puede
 * vaciarse al editar. Los vehiculos existentes sin capacidad (NULL) siguen editables mientras no se envie
 * `passengerCapacity: null` de forma explicita.
 */
/** Respuestas 2026-10-20 #3: la capacidad es siempre > 0 (entero 1..60); 0 y negativos tampoco son validos. */
export function isValidPassengerCapacity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 60;
}

export class VehiclePassengerCapacityRequiredError extends DomainBadRequestError {
  readonly code = 'PASSENGER_CAPACITY_REQUIRED';

  constructor() {
    super('La capacidad de pasajeros del vehículo es obligatoria (entero entre 1 y 60).');
  }
}
