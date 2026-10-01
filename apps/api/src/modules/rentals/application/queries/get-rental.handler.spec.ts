import { NotFoundException } from '@nestjs/common';
import { GetRentalHandler } from './get-rental.handler';
import { GetRentalQuery } from './get-rental.query';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

describe('GetRentalHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-600',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Ana Ruiz',
    customerDocNumber: '33445566',
    vehicleId: 'veh-1',
    vehiclePlate: 'MNO-005',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
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

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
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

  it('alquiler existe en empresa/sede → retorna RentalRecord', async () => {
    const deps = buildDeps();
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

    expect(result).toEqual(fakeRental);
    expect(deps.rentals.findById).toHaveBeenCalledWith(
      'rent-600',
      expect.objectContaining({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
      }),
    );
  });

  it('alquiler no existe → lanza NotFoundException', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue(null);
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    await expect(
      handler.execute(new GetRentalQuery('rent-inexistente', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(NotFoundException);
  });

  it('WorkContextAuthorizationService establece el scope antes de ejecutar el query', async () => {
    const deps = buildDeps();
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

    expect(deps.workContext.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'uid-1', companyId: 'comp-1', branchId: 'branch-1' }),
    );
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'FRONT_OFFICE', 'RENTAL', 'READ');
  });
});
