import { NotFoundException } from '@nestjs/common';
import { UpdateVehicleHandler } from './update-vehicle.handler';
import { UpdateVehicleCommand } from './update-vehicle.command';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildFleetAccessService,
} from '../../testing/fleet-test-fixtures';

describe('UpdateVehicleHandler', () => {
  it('actualiza los datos editables de un vehículo existente', async () => {
    const vehicle = buildFleetVehicle();
    const repository = buildFleetVehicleRepository(vehicle);
    const { access, workContext } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleHandler(repository, access);

    const command = new UpdateVehicleCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      ' Hyundai ',
      ' Tucson ',
      2023,
      ' Negro ',
      ' SUV ',
      190,
      undefined,
      'https://storage.googleapis.com/test-bucket/vehicle-photos/tucson.jpg',
    );

    const result = await handler.execute(command);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findById).toHaveBeenCalledWith('veh-1', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(repository.update).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: ORG, operatingCompanyId: COMPANY },
      {
        branchId: BRANCH,
        brand: 'Hyundai',
        model: 'Tucson',
        year: 2023,
        color: 'Negro',
        category: 'SUV',
        dailyRate: 190,
        photoUrl: 'https://storage.googleapis.com/test-bucket/vehicle-photos/tucson.jpg',
      },
    );
    expect(result.brand).toBe('Hyundai');
  });

  it('lanza NotFoundException si el vehículo no existe en la empresa', async () => {
    const repository = buildFleetVehicleRepository(null);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleHandler(repository, access);

    const command = new UpdateVehicleCommand(
      'uid-1',
      'inexistente',
      COMPANY,
      BRANCH,
      'Nissan',
      'Frontier',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('conserva brand y model existentes cuando no se proporcionan en el comando', async () => {
    const vehicle = buildFleetVehicle({ brand: 'Toyota', model: 'Hilux' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleHandler(repository, access);

    const command = new UpdateVehicleCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      undefined,
      undefined,
      2022,
    );

    await handler.execute(command);

    expect(repository.update).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: ORG, operatingCompanyId: COMPANY },
      expect.objectContaining({ brand: 'Toyota', model: 'Hilux', year: 2022 }),
    );
  });

  it('no permite editar la placa: el comando no acepta ese campo', async () => {
    const vehicle = buildFleetVehicle({ plate: 'ABC-123' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleHandler(repository, access);

    const command = new UpdateVehicleCommand('uid-1', 'veh-1', COMPANY, BRANCH, 'Toyota', 'Hilux');

    const result = await handler.execute(command);

    expect(result.plate).toBe('ABC-123');
  });
});
