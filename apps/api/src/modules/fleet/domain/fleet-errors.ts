import { DomainBadRequestError, DomainConflictError } from '../../../common/domain/domain-errors';

export class VehiclePlateAlreadyExistsError extends DomainConflictError {
  readonly code = 'VEHICLE_PLATE_ALREADY_EXISTS';

  constructor(plate: string) {
    super(`Ya existe un vehículo registrado con la placa ${plate}.`);
  }
}

/**
 * DEC-FLT-CAP-001 (G-05): la capacidad de pasajeros es obligatoria al registrar un vehiculo y no puede
 * vaciarse al editar. Los vehiculos existentes sin capacidad (NULL) siguen editables mientras no se envie
 * `passengerCapacity: null` de forma explicita.
 */
export class VehiclePassengerCapacityRequiredError extends DomainBadRequestError {
  readonly code = 'PASSENGER_CAPACITY_REQUIRED';

  constructor() {
    super('La capacidad de pasajeros del vehículo es obligatoria (entero entre 1 y 60).');
  }
}
