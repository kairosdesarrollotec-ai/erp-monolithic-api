import { ListRentalsHandler } from './list-rentals.handler';
import { ListRentalsQuery } from './list-rentals.query';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

describe('ListRentalsHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-700',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Carlos Mena',
    customerDocNumber: '66778899',
    vehicleId: 'veh-1',
    vehiclePlate: 'PQR-006',
    vehicleBrand: 'Honda',
    vehicleModel: 'Civic',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'DRAFT',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 1,
  };

  function buildDeps(list: RentalRecord[] = []) {
    const rentals = {
      list: jest.fn().mockResolvedValue(list),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        role: 'FRONT_OFFICE',
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    return { rentals, workContext, matrixAuth };
  }

  it('lista vacia → retorna array vacio', async () => {
    const deps = buildDeps([]);
    const handler = new ListRentalsHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new ListRentalsQuery('uid-1', 'comp-1', 'branch-1'));

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('lista con items → retorna array de RentalRecord', async () => {
    const deps = buildDeps([fakeRental, { ...fakeRental, id: 'rent-701' }]);
    const handler = new ListRentalsHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new ListRentalsQuery('uid-1', 'comp-1', 'branch-1'));

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rent-700');
    expect(result[1].id).toBe('rent-701');
  });

  it('scope siempre filtrado por organizationId + operatingCompanyId + branchId', async () => {
    const deps = buildDeps([fakeRental]);
    const handler = new ListRentalsHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    await handler.execute(new ListRentalsQuery('uid-1', 'comp-1', 'branch-1'));

    expect(deps.rentals.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      }),
    );
  });

  it('pasa el parametro status al repositorio cuando se especifica', async () => {
    const deps = buildDeps([]);
    const handler = new ListRentalsHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    await handler.execute(new ListRentalsQuery('uid-1', 'comp-1', 'branch-1', 'DRAFT', 10));

    expect(deps.rentals.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT', limit: 10 }),
    );
  });
});
