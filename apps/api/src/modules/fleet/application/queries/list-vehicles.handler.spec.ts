import { ListVehiclesHandler } from './list-vehicles.handler';
import { ListVehiclesQuery } from './list-vehicles.query';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildFleetAccessService,
} from '../../testing/fleet-test-fixtures';

describe('ListVehiclesHandler', () => {
  it('consulta la lista de vehículos con filtros y paginación para el contexto autorizado', async () => {
    const vehicle = buildFleetVehicle();
    const repository = buildFleetVehicleRepository(vehicle);
    const { access, workContext } = buildFleetAccessService();
    const handler = new ListVehiclesHandler(repository, access);

    const query = new ListVehiclesQuery(
      'uid-1',
      COMPANY,
      BRANCH,
      BRANCH,
      'AVAILABLE',
      'Hilux',
      20,
      0,
    );

    const result = await handler.execute(query);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.list).toHaveBeenCalledWith({
      organizationId: ORG,
      operatingCompanyId: COMPANY,
      branchId: BRANCH,
      status: 'AVAILABLE',
      search: 'Hilux',
      limit: 20,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
