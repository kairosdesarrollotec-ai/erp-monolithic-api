import { NotFoundException } from '@nestjs/common';
import { GetRentalHandler } from './get-rental.handler';
import { GetRentalQuery } from './get-rental.query';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { testRole } from '../../../users/testing/role-fixtures';

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

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      listExtensionsByRentalId: jest.fn().mockResolvedValue([]),
      findReservationCreditSource: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        ...testRole('FRONT_OFFICE'),
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    return { rentals, workContext, matrixAuth };
  }

  it('con conductor de la empresa expone la tarifa diaria x dias (configurable; sin tarifa -> configured=false)', async () => {
    const deps = buildDeps();
    const start = new Date('2026-10-01T10:00:00Z');
    (deps.rentals.findById as jest.Mock).mockResolvedValue({
      ...fakeRental,
      startAt: start,
      expectedEndAt: new Date('2026-10-04T10:00:00Z'),
      contract: { contractVariant: 'NATURAL_WITH_DRIVER' },
    });
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);
    const q = new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1');
    const prev = process.env.COMPANY_DRIVER_DAILY_RATE;
    try {
      delete process.env.COMPANY_DRIVER_DAILY_RATE;
      expect((await handler.execute(q)).companyDriverCharge).toMatchObject({ configured: false, source: 'NOT_DEFINED', days: 3, total: '0.00' });
      process.env.COMPANY_DRIVER_DAILY_RATE = '80';
      expect((await handler.execute(q)).companyDriverCharge).toEqual({ configured: true, source: 'ENV', dailyRate: '80.00', currency: 'PEN', days: 3, total: '240.00' });
      // DEC-ALQ-DRIVERRATE-001: el valor manual del alquiler tiene prioridad sobre el env.
      (deps.rentals.findById as jest.Mock).mockResolvedValue({
        ...fakeRental,
        startAt: start,
        expectedEndAt: new Date('2026-10-04T10:00:00Z'),
        contract: { contractVariant: 'NATURAL_WITH_DRIVER' },
        companyDriverDailyRate: '120.50',
      });
      expect((await handler.execute(q)).companyDriverCharge).toEqual({ configured: true, source: 'MANUAL', dailyRate: '120.50', currency: 'PEN', days: 3, total: '361.50' });
      // Sin env y con valor manual: tambien MANUAL.
      delete process.env.COMPANY_DRIVER_DAILY_RATE;
      expect((await handler.execute(q)).companyDriverCharge).toMatchObject({ source: 'MANUAL', total: '361.50' });
    } finally {
      if (prev === undefined) delete process.env.COMPANY_DRIVER_DAILY_RATE; else process.env.COMPANY_DRIVER_DAILY_RATE = prev;
    }
  });

  it('alquiler existe en empresa/sede → retorna RentalRecord', async () => {
    const deps = buildDeps();
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

    // Alquiler directo: sin reserva de origen no hay credito que mostrar.
    expect(result).toEqual({ ...fakeRental, reservationCredit: null, extensions: [], companyDriverCharge: null });
    expect(deps.rentals.findReservationCreditSource).not.toHaveBeenCalled();
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
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-FRONT_OFFICE', 'RENTAL', 'READ', expect.anything());
  });

  describe('P0-03 (a) - vista previa del traslado reserva -> garantia', () => {
    const reservationRental: RentalRecord = { ...fakeRental, reservationId: 'res-1', status: 'CONTRACTING' };
    const source = {
      reservationId: 'res-1',
      status: 'CONFIRMED',
      amount: '300.00',
      currency: 'PEN',
      paymentValidatedAt: new Date('2026-10-01T10:00:00Z'),
    };

    it('origen Reserva confirmada con pago validado: expone el credito de S/300', async () => {
      const deps = buildDeps();
      deps.rentals.findById.mockResolvedValue(reservationRental);
      deps.rentals.findReservationCreditSource.mockResolvedValue(source);
      const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

      const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

      expect(result.reservationCredit).toEqual({
        applicable: true,
        reason: 'APPLIED',
        reservationId: 'res-1',
        amount: '300.00',
        currency: 'PEN',
      });
    });

    it('reserva cancelada/no-show: el credito no aplica', async () => {
      const deps = buildDeps();
      deps.rentals.findById.mockResolvedValue(reservationRental);
      deps.rentals.findReservationCreditSource.mockResolvedValue({ ...source, status: 'CANCELLED' });
      const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

      const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

      expect(result.reservationCredit).toMatchObject({ applicable: false, reason: 'RESERVATION_NOT_ACTIVE', amount: '0.00' });
    });

    it('reserva con monto distinto del estandar: expone ese monto', async () => {
      const deps = buildDeps();
      deps.rentals.findById.mockResolvedValue(reservationRental);
      deps.rentals.findReservationCreditSource.mockResolvedValue({ ...source, amount: '450.00' });
      const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

      const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

      expect(result.reservationCredit?.amount).toBe('450.00');
    });
  });

  it('ALQ-10/ALQ-11: incluye las ampliaciones del alquiler', async () => {
    const deps = buildDeps();
    const extension = {
      id: 'ext-1',
      rentalId: 'rent-600',
      requestedEndAt: new Date('2026-10-12T10:00:00Z'),
      status: 'PENDING' as const,
      paymentId: null,
      addendumDocumentRef: null,
      requestedAt: new Date('2026-10-10T10:00:00Z'),
      resolvedAt: null,
    };
    deps.rentals.listExtensionsByRentalId.mockResolvedValue([extension]);
    const handler = new GetRentalHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new GetRentalQuery('rent-600', 'uid-1', 'comp-1', 'branch-1'));

    expect(result.extensions).toEqual([extension]);
  });
});
