import { NotFoundException } from '@nestjs/common';
import { GetVehicleHandler } from './get-vehicle.handler';
import { GetVehicleQuery } from './get-vehicle.query';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildWorkContext,
} from '../../testing/fleet-test-fixtures';

describe('GetVehicleHandler', () => {
  it('obtiene el vehículo solicitado si pertenece a la empresa autorizada', async () => {
    const vehicle = buildFleetVehicle();
    const repository = buildFleetVehicleRepository(vehicle);
    const workContext = buildWorkContext();
    const handler = new GetVehicleHandler(repository, workContext);

    const query = new GetVehicleQuery('uid-1', 'veh-1', COMPANY, BRANCH);
    const result = await handler.execute(query);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findById).toHaveBeenCalledWith('veh-1', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(result.id).toBe('veh-1');
  });

  it('lanza NotFoundException si el vehículo no existe', async () => {
    const repository = buildFleetVehicleRepository(null);
    const workContext = buildWorkContext();
    const handler = new GetVehicleHandler(repository, workContext);

    const query = new GetVehicleQuery('uid-1', 'inexistente', COMPANY, BRANCH);

    await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
  });
});
