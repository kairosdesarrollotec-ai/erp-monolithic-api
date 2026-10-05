import { RegisterAlcoholTestHandler } from './register-alcohol-test.handler';
import { RegisterAlcoholTestCommand } from './register-alcohol-test.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';

describe('RegisterAlcoholTestHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Juan Perez',
    customerDocNumber: '12345678',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'VALIDATION',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: null,
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 2,
  };

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      saveAlcoholTest: jest.fn().mockImplementation((input) =>
        Promise.resolve({
          ...fakeRental,
          alcoholTestResult: input.result,
          status: input.result === 'FAVORABLE' ? 'NOTARY_EVALUATION' : 'CANCELLED',
          version: input.expectedVersion + 1,
        }),
      ),
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

    const transactionManager: jest.Mocked<TransactionManagerPort> = {
      run: jest.fn((work: any) => work(fakeTx)),
    };

    const auditRepository: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn(),
      recordReservationEvent: jest.fn(),
      recordInquiryEvent: jest.fn(),
      recordAdminEvent: jest.fn(),
      recordRentalEvent: jest.fn().mockResolvedValue(undefined),
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  it('resultado FAVORABLE transiciona a NOTARY_EVALUATION y publica AlcoholTestPassed.v1', async () => {
    const deps = buildDeps();
    const handler = new RegisterAlcoholTestHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE'),
    );

    expect(result.status).toBe('NOTARY_EVALUATION');
    expect(result.alcoholTestResult).toBe('FAVORABLE');
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALCOHOL_TEST_PASSED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AlcoholTestPassed.v1' }),
      fakeTx,
    );
  });

  it('resultado DESFAVORABLE cancela el alquiler inmediatamente por tolerancia cero (BR-ALQ-005)', async () => {
    const deps = buildDeps();
    const handler = new RegisterAlcoholTestHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'DESFAVORABLE'),
    );

    expect(result.status).toBe('CANCELLED');
    expect(result.alcoholTestResult).toBe('DESFAVORABLE');
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALCOHOL_TEST_FAILED_RENTAL_CANCELLED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AlcoholTestFailed.v1' }),
      fakeTx,
    );
  });

  it('rechazar la prueba (RECHAZADO) equivale a desfavorable y cancela el alquiler', async () => {
    const deps = buildDeps();
    const handler = new RegisterAlcoholTestHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'RECHAZADO'),
    );

    expect(result.status).toBe('CANCELLED');
    expect(result.alcoholTestResult).toBe('RECHAZADO');
  });

  it('rechaza ejecucion si el alquiler no esta en estado VALIDATION', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValueOnce({ ...fakeRental, status: 'DRAFT' });

    const handler = new RegisterAlcoholTestHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE')),
    ).rejects.toThrow(RentalStateConflictError);
  });
});
