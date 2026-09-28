import { CreateVehicleHandler } from './create-vehicle.handler';
import { CreateVehicleCommand } from './create-vehicle.command';
import { VehiclePlateAlreadyExistsError } from '../../domain/fleet-errors';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildWorkContext,
} from '../../testing/fleet-test-fixtures';

describe('CreateVehicleHandler', () => {
  it('registra un nuevo vehículo con placa sanitizada y datos completos', async () => {
    const repository = buildFleetVehicleRepository();
    const workContext = buildWorkContext();
    const handler = new CreateVehicleHandler(repository, workContext);

    const command = new CreateVehicleCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      '  xyz-789  ',
      ' Hyundai ',
      ' Tucson ',
      2023,
      ' Negro ',
      ' SUV ',
      'AVAILABLE',
      190,
      'https://example.com/tucson.jpg',
    );

    const result = await handler.execute(command);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findByPlate).toHaveBeenCalledWith('XYZ-789');
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      plate: 'XYZ-789',
      brand: 'Hyundai',
      model: 'Tucson',
      year: 2023,
      color: 'Negro',
      category: 'SUV',
      status: 'AVAILABLE',
      dailyRate: 190,
      photoUrl: 'https://example.com/tucson.jpg',
    });
    expect(result.plate).toBe('XYZ-789');
  });

  it('lanza VehiclePlateAlreadyExistsError si la placa ya existe', async () => {
    const existing = buildFleetVehicle({ plate: 'XYZ-789' });
    const repository = buildFleetVehicleRepository();
    repository.findByPlate.mockResolvedValue(existing);

    const workContext = buildWorkContext();
    const handler = new CreateVehicleHandler(repository, workContext);

    const command = new CreateVehicleCommand(
      'uid-1',
      COMPANY,
      BRANCH,
      'xyz-789',
      'Nissan',
      'Frontier',
    );

    await expect(handler.execute(command)).rejects.toThrow(VehiclePlateAlreadyExistsError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
