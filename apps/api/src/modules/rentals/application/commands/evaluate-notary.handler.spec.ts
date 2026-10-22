import { NotFoundException } from '@nestjs/common';
import { EvaluateNotaryHandler } from './evaluate-notary.handler';
import { EvaluateNotaryCommand } from './evaluate-notary.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

describe('EvaluateNotaryHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-300',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Pedro Torres',
    customerDocNumber: '55443322',
    vehicleId: 'veh-1',
    vehiclePlate: 'DEF-002',
    vehicleBrand: 'Nissan',
    vehicleModel: 'Versa',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'NOTARY_EVALUATION',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 3,
  };

  const fakeTx = {} as any;

  function buildDeps(overrides?: {
    previousRentalsCount?: number;
    biometricVerified?: boolean;
    vehicleModel?: string;
    thirdPathEligible?: boolean;
    depositMinimum?: string | null;
  }) {
    const opts = { previousRentalsCount: 0, biometricVerified: false, vehicleModel: 'Versa', thirdPathEligible: false, depositMinimum: null, ...overrides };

    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      findVehicleById: jest.fn().mockResolvedValue({
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        plate: 'DEF-002',
        brand: 'Nissan',
        model: opts.vehicleModel,
        status: 'RENTED',
        thirdPathEligible: opts.thirdPathEligible,
        depositMinimum: opts.depositMinimum,
      }),
      findCustomerById: jest.fn().mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        fullName: 'Pedro Torres',
        documentNumber: '55443322',
        isBiometricVerified: opts.biometricVerified,
      }),
      countPreviousRentalsByCustomer: jest.fn().mockResolvedValue(opts.previousRentalsCount),
      saveNotaryEvaluation: jest.fn().mockResolvedValue(undefined),
      transitionStatus: jest.fn().mockResolvedValue({ ...fakeRental, status: 'CONTRACTING', version: 4 }),
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

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  function buildHandler(deps: ReturnType<typeof buildDeps>) {
    return new EvaluateNotaryHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
  }

  it('evaluacion sin requiresApproval (cliente nuevo => DOUBLE_DEPOSIT x2) persiste la evaluacion y transiciona a CONTRACTING', async () => {
    const deps = buildDeps({ previousRentalsCount: 0, depositMinimum: '500.00' });
    // El handler devuelve el alquiler releido tras guardar/transicionar.
    deps.rentals.findById.mockResolvedValueOnce(fakeRental).mockResolvedValueOnce({ ...fakeRental, status: 'CONTRACTING', version: 4 });
    const handler = buildHandler(deps);

    const result = await handler.execute(new EvaluateNotaryCommand('rent-300', 'uid-1', 'comp-1', 'branch-1', 3));

    expect(result.rental.status).toBe('CONTRACTING');
    expect(result.evaluation).toMatchObject({
      result: 'DOUBLE_DEPOSIT',
      policyVersion: expect.any(Number),
      reason: expect.any(String),
      requiresApproval: false,
      depositMultiplier: 2,
      requiredGuarantee: { baseAmount: '500.00', multiplier: 2, amount: '1000.00' },
    });
    expect(deps.rentals.saveNotaryEvaluation).toHaveBeenCalledWith(expect.objectContaining({ rentalId: 'rent-300', result: 'DOUBLE_DEPOSIT' }), fakeTx);
    expect(deps.rentals.transitionStatus).toHaveBeenCalledWith(
      'rent-300',
      expect.objectContaining({ organizationId: 'org-1' }),
      'CONTRACTING',
      3,
      'uid-1',
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTARY_EVALUATED_AUTOMATIC' }),
      fakeTx,
    );
  });

  it('THIRD_PATH_ELIGIBLE (cliente antiguo + biometrico + vehiculo elegible): PERSISTE la evaluacion, no transiciona y no duplica la garantia', async () => {
    const deps = buildDeps({ previousRentalsCount: 3, thirdPathEligible: true, depositMinimum: '500.00' });
    const handler = buildHandler(deps);

    const result = await handler.execute(new EvaluateNotaryCommand('rent-300', 'uid-1', 'comp-1', 'branch-1', 3, true));

    expect(result.rental.status).toBe('NOTARY_EVALUATION');
    expect(result.evaluation).toMatchObject({ result: 'THIRD_PATH_ELIGIBLE', requiresApproval: true, depositMultiplier: 1 });
    expect(result.evaluation.requiredGuarantee).toMatchObject({ multiplier: 1, amount: '500.00' });
    expect(deps.rentals.saveNotaryEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'THIRD_PATH_ELIGIBLE', biometricVerified: true, biometricVerifiedBy: 'uid-1' }),
      fakeTx,
    );
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTARY_EVALUATED_PENDING_APPROVAL' }),
      fakeTx,
    );
  });

  it('MANUAL_REVIEW (cliente antiguo sin biometrico): tambien persiste la evaluacion para que Gerencia apruebe el tipo correcto', async () => {
    const deps = buildDeps({ previousRentalsCount: 5, thirdPathEligible: true });
    const handler = buildHandler(deps);

    const result = await handler.execute(new EvaluateNotaryCommand('rent-300', 'uid-1', 'comp-1', 'branch-1', 3, false));

    expect(result.evaluation).toMatchObject({ result: 'MANUAL_REVIEW', requiresApproval: true });
    expect(deps.rentals.saveNotaryEvaluation).toHaveBeenCalledWith(expect.objectContaining({ result: 'MANUAL_REVIEW' }), fakeTx);
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('estado distinto de NOTARY_EVALUATION lanza RentalStateConflictError', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'DRAFT' });

    const handler = new EvaluateNotaryHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new EvaluateNotaryCommand('rent-300', 'uid-1', 'comp-1', 'branch-1', 3)),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('alquiler no encontrado lanza NotFoundException', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue(null);

    const handler = new EvaluateNotaryHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(new EvaluateNotaryCommand('rent-inexistente', 'uid-1', 'comp-1', 'branch-1', 3)),
    ).rejects.toThrow(NotFoundException);
  });
});
