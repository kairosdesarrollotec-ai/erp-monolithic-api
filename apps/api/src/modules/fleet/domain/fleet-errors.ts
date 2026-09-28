import { ConflictException } from '@nestjs/common';

export class VehiclePlateAlreadyExistsError extends ConflictException {
  constructor(plate: string) {
    super({
      code: 'VEHICLE_PLATE_ALREADY_EXISTS',
      detail: `Ya existe un vehículo registrado con la placa ${plate}.`,
    });
  }
}
