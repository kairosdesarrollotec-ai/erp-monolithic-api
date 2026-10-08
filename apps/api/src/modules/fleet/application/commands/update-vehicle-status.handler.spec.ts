import { NotFoundException } from '@nestjs/common';
import { UpdateVehicleStatusHandler } from './update-vehicle-status.handler';
import { UpdateVehicleStatusCommand } from './update-vehicle-status.command';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildFleetAccessService,
} from '../../testing/fleet-test-fixtures';

describe('UpdateVehicleStatusHandler', () => {
  it('actualiza el estado de un vehículo existente', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access, workContext } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleStatusHandler(repository, access);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'MAINTENANCE',
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
    expect(repository.updateStatus).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: ORG, operatingCompanyId: COMPANY },
      'MAINTENANCE',
    );
    expect(result.status).toBe('MAINTENANCE');
  });

  it('lanza NotFoundException si el vehículo no existe en la empresa', async () => {
    const repository = buildFleetVehicleRepository(null);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleStatusHandler(repository, access);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'inexistente',
      COMPANY,
      BRANCH,
      'RENTED',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });
});
