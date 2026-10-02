import { DomainConflictError } from '../../../common/domain/domain-errors';

export class VehiclePlateAlreadyExistsError extends DomainConflictError {
  readonly code = 'VEHICLE_PLATE_ALREADY_EXISTS';

  constructor(plate: string) {
    super(`Ya existe un vehículo registrado con la placa ${plate}.`);
  }
}
