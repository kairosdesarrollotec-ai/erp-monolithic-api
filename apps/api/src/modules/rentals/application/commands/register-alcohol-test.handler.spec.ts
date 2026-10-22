import { RegisterAlcoholTestHandler } from './register-alcohol-test.handler';
import { RegisterAlcoholTestCommand } from './register-alcohol-test.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalEvidenceRepositoryPort } from '../ports/rental-evidence-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

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
        ...testRole('FRONT_OFFICE'),
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
      recordIncidentEvent: jest.fn(),
      recordRecruitmentEvent: jest.fn(),
      recordHrAdministrationEvent: jest.fn(),
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const alcoholPhoto = { id: 'ev-alc', rentalId: 'rent-1', type: 'PHOTO', zone: 'ALCOHOL_TEST', objectUrl: 'https://storage.googleapis.com/b/x.jpg', uploadedBy: 'u', uploadedAt: new Date() };
    const evidenceRepository = {
      list: jest.fn().mockResolvedValue([alcoholPhoto]),
    } as unknown as jest.Mocked<RentalEvidenceRepositoryPort>;

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository, evidenceRepository };
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
      deps.evidenceRepository,
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
      deps.evidenceRepository,
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
      deps.evidenceRepository,
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
      deps.evidenceRepository,
    );

    await expect(
      handler.execute(new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE')),
    ).rejects.toThrow(RentalStateConflictError);
  });

  describe('ENTREGA-02 (Respuestas 2026-10-20 #10): foto de la prueba obligatoria si no es favorable, sin hora', () => {
    const mk = (deps: ReturnType<typeof buildDeps>) =>
      new RegisterAlcoholTestHandler(
        deps.rentals,
        deps.workContext,
        deps.matrixAuth,
        deps.transactionManager,
        deps.auditRepository,
        deps.outboxRepository,
        deps.evidenceRepository,
      );

    it.each(['DESFAVORABLE', 'RECHAZADO'] as const)('%s sin foto ALCOHOL_TEST -> 422 ALCOHOL_TEST_PHOTO_REQUIRED y no guarda', async (result) => {
      const deps = buildDeps();
      deps.evidenceRepository.list.mockResolvedValue([
        { id: 'e1', rentalId: 'rent-1', type: 'PHOTO', zone: 'FRONTAL', objectUrl: 'x', uploadedBy: 'u', uploadedAt: new Date() },
        { id: 'e2', rentalId: 'rent-1', type: 'VIDEO', zone: 'ALCOHOL_TEST', objectUrl: 'x', uploadedBy: 'u', uploadedAt: new Date() },
      ]);

      await expect(
        mk(deps).execute(new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, result)),
      ).rejects.toMatchObject({ code: 'ALCOHOL_TEST_PHOTO_REQUIRED', httpStatus: 422 });
      expect(deps.rentals.saveAlcoholTest).not.toHaveBeenCalled();
      expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
    });

    it.each(['DESFAVORABLE', 'RECHAZADO'] as const)('%s con la foto: cancela y deja el id de la evidencia en auditoria y evento', async (result) => {
      const deps = buildDeps();
      await mk(deps).execute(new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, result));

      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ alcoholPhotoEvidenceId: 'ev-alc' }) }),
        fakeTx,
      );
      expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ alcoholPhotoEvidenceId: 'ev-alc' }) }),
        fakeTx,
      );
    });

    it('FAVORABLE no exige foto ni consulta evidencias', async () => {
      const deps = buildDeps();
      deps.evidenceRepository.list.mockResolvedValue([]);
      await mk(deps).execute(new RegisterAlcoholTestCommand('rent-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE'));
      expect(deps.evidenceRepository.list).not.toHaveBeenCalled();
      expect(deps.rentals.saveAlcoholTest).toHaveBeenCalled();
    });
  });
});
