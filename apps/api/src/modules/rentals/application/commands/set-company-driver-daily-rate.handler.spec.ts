import { NotFoundException } from '@nestjs/common';
import { SetCompanyDriverDailyRateHandler } from './set-company-driver-daily-rate.handler';
import { SetCompanyDriverDailyRateCommand } from './set-company-driver-daily-rate.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { testRole } from '../../../users/testing/role-fixtures';

describe('SetCompanyDriverDailyRateHandler (DEC-ALQ-DRIVERRATE-001, F-02)', () => {
  const fakeTx = {} as any;
  const contract = (variant: string | null) =>
    ({ id: 'c', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, contractVariant: variant, createdAt: new Date() }) as any;
  const baseRental: RentalRecord = {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Titular',
    customerDocNumber: '1',
    vehicleId: 'veh-1',
    vehiclePlate: 'AAA-111',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Yaris',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'PENDING_DELIVERY',
    startAt: new Date('2026-10-01T10:00:00Z'),
    expectedEndAt: new Date('2026-10-04T10:00:00Z'),
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'u',
    updatedAt: new Date(),
    updatedBy: 'u',
    version: 3,
    companyDriverDailyRate: null,
    contract: contract('NATURAL_WITH_DRIVER'),
  };

  function build(rental: RentalRecord | null = baseRental) {
    const rentals = {
      findById: jest.fn().mockResolvedValue(rental),
      setCompanyDriverDailyRate: jest
        .fn()
        .mockImplementation(async (input: any) => ({ ...(rental as RentalRecord), version: 4, companyDriverDailyRate: input.dailyRate })),
    } as unknown as jest.Mocked<RentalRepositoryPort>;
    const workContext = {
      authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', ...testRole('FRONT_OFFICE') }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MatrixAuthorizationService>;
    const transactionManager: jest.Mocked<TransactionManagerPort> = { run: jest.fn((work: any) => work(fakeTx)) };
    const audit = { recordRentalEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
    const outbox: jest.Mocked<OutboxEventRepositoryPort> = { publish: jest.fn().mockResolvedValue(undefined) };
    return { rentals, matrixAuth, audit, outbox, handler: new SetCompanyDriverDailyRateHandler(rentals, workContext, matrixAuth, transactionManager, audit, outbox) };
  }

  const cmd = (dailyRate = '120') => new SetCompanyDriverDailyRateCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 3, dailyRate);

  const savedEnv = process.env.COMPANY_DRIVER_DAILY_RATE;
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.COMPANY_DRIVER_DAILY_RATE; else process.env.COMPANY_DRIVER_DAILY_RATE = savedEnv;
  });

  it('guarda la tarifa normalizada, audita (valor anterior y nuevo), publica el evento y devuelve companyDriverCharge MANUAL', async () => {
    process.env.COMPANY_DRIVER_DAILY_RATE = '80';
    const d = build({ ...baseRental, companyDriverDailyRate: '80.00' });

    const result = await d.handler.execute(cmd('120.5'));

    expect(d.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', expect.anything(), 'RENTAL', 'FORMALIZE_CONTRACT', expect.anything());
    expect(d.rentals.setCompanyDriverDailyRate).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', expectedVersion: 3, dailyRate: '120.50', updatedBy: 'uid-1' }),
      fakeTx,
    );
    expect(result.version).toBe(4);
    expect(result.companyDriverCharge).toEqual({ configured: true, source: 'MANUAL', dailyRate: '120.50', currency: 'PEN', days: 3, total: '361.50' });
    expect(d.audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_DRIVER_RATE_SET',
        rentalId: 'rent-1',
        changes: expect.objectContaining({ previousDailyRate: '80.00', dailyRate: '120.50', currency: 'PEN' }),
      }),
      fakeTx,
    );
    expect(d.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'rental', aggregateId: 'rent-1', eventType: 'TarifaConductorEmpresaDefinida.v1' }),
      fakeTx,
    );
  });

  it('sin env: la tarifa manual deja de ser NOT_DEFINED', async () => {
    delete process.env.COMPANY_DRIVER_DAILY_RATE;
    const result = await build().handler.execute(cmd('100'));
    expect(result.companyDriverCharge).toMatchObject({ source: 'MANUAL', dailyRate: '100.00', total: '300.00' });
  });

  it('PENDING_DELIVERY (contrato formalizado, entrega sin completar): editable', async () => {
    await expect(build({ ...baseRental, status: 'PENDING_DELIVERY' }).handler.execute(cmd())).resolves.toBeDefined();
  });

  // Respuestas 2026-10-20 #2: editable hasta que termina el proceso de alquiler (completar entrega); la devolucion es otro proceso.
  it.each(['ACTIVE', 'EXTENSION_PENDING', 'RETURN_IN_PROGRESS', 'CLOSED', 'CANCELLED'] as const)('estado %s (proceso de alquiler terminado) -> 409 COMPANY_DRIVER_RATE_CLOSED', async (status) => {
    const d = build({ ...baseRental, status });
    await expect(d.handler.execute(cmd())).rejects.toMatchObject({ code: 'COMPANY_DRIVER_RATE_CLOSED', httpStatus: 409 });
    expect(d.rentals.setCompanyDriverDailyRate).not.toHaveBeenCalled();
    expect(d.audit.recordRentalEvent).not.toHaveBeenCalled();
  });

  it('alquiler sin conductor de la empresa o sin contrato formalizado -> 422 COMPANY_DRIVER_RATE_NOT_APPLICABLE', async () => {
    for (const rental of [
      { ...baseRental, contract: contract('NATURAL_NO_DRIVER') },
      { ...baseRental, contract: contract('LEGAL_NO_DRIVER') },
      { ...baseRental, contract: null },
      { ...baseRental, status: 'CONTRACTING' as const, contract: null },
    ]) {
      const d = build(rental);
      await expect(d.handler.execute(cmd())).rejects.toMatchObject({ code: 'COMPANY_DRIVER_RATE_NOT_APPLICABLE', httpStatus: 422 });
      expect(d.rentals.setCompanyDriverDailyRate).not.toHaveBeenCalled();
    }
  });

  it('persona juridica con conductor de la empresa tambien aplica', async () => {
    await expect(build({ ...baseRental, contract: contract('LEGAL_WITH_DRIVER') }).handler.execute(cmd())).resolves.toBeDefined();
  });

  it.each(['0', '0.00', '-5', '12.345', '100000000', 'abc', ''])('monto %p -> 400 COMPANY_DRIVER_RATE_INVALID', async (bad) => {
    const d = build();
    await expect(d.handler.execute(cmd(bad))).rejects.toMatchObject({ code: 'COMPANY_DRIVER_RATE_INVALID', httpStatus: 400 });
    expect(d.rentals.setCompanyDriverDailyRate).not.toHaveBeenCalled();
  });

  it('alquiler inexistente en el alcance -> 404', async () => {
    await expect(build(null).handler.execute(cmd())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin permiso (matriz ADM-02) no toca el repositorio', async () => {
    const d = build();
    d.matrixAuth.assertAllowed.mockRejectedValueOnce(new Error('forbidden'));
    await expect(d.handler.execute(cmd())).rejects.toThrow('forbidden');
    expect(d.rentals.findById).not.toHaveBeenCalled();
    expect(d.rentals.setCompanyDriverDailyRate).not.toHaveBeenCalled();
  });
});
