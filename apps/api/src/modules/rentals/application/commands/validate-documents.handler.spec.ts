import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ValidateDocumentsHandler } from './validate-documents.handler';
import { ValidateDocumentsCommand } from './validate-documents.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';

describe('ValidateDocumentsHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-200',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Maria Lopez',
    customerDocNumber: '99887766',
    vehicleId: 'veh-1',
    vehiclePlate: 'XYZ-001',
    vehicleBrand: 'Kia',
    vehicleModel: 'Rio',
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

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      transitionStatus: jest.fn().mockResolvedValue({ ...fakeRental, status: 'VALIDATION', version: 2 }),
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
      recordIncidentEvent: jest.fn(),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository };
  }

  it('estado DRAFT con documentos completos (BR-CON-004) transiciona a VALIDATION', async () => {
    const deps = buildDeps();
    const handler = new ValidateDocumentsHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
    );

    const result = await handler.execute(
      new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, {
        identityDocumentValid: true,
        driverLicenseValid: true,
        addressOrStayProofValid: true,
      }),
    );

    expect(result.status).toBe('VALIDATION');
    expect(deps.rentals.transitionStatus).toHaveBeenCalledWith(
      'rent-200',
      expect.objectContaining({ organizationId: 'org-1' }),
      'VALIDATION',
      1,
      'uid-1',
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DOCUMENTS_VALIDATED' }),
      fakeTx,
    );
  });

  it('estado distinto de DRAFT lanza RentalStateConflictError', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'VALIDATION' });

    const handler = new ValidateDocumentsHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
    );

    await expect(
      handler.execute(
        new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 2, {
          identityDocumentValid: true,
          driverLicenseValid: true,
          addressOrStayProofValid: true,
        }),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('documentos incompletos lanza UnprocessableEntityException con code DOCUMENTS_INCOMPLETE', async () => {
    const deps = buildDeps();
    const handler = new ValidateDocumentsHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
    );

    await expect(
      handler.execute(
        new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, {
          identityDocumentValid: true,
          driverLicenseValid: false,
          addressOrStayProofValid: false,
        }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    await expect(
      handler.execute(
        new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, {
          identityDocumentValid: true,
          driverLicenseValid: false,
          addressOrStayProofValid: false,
        }),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DOCUMENTS_INCOMPLETE' }) });
  });

  it('alquiler no encontrado lanza NotFoundException', async () => {
    const deps = buildDeps();
    deps.rentals.findById.mockResolvedValue(null);

    const handler = new ValidateDocumentsHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
    );

    await expect(
      handler.execute(new ValidateDocumentsCommand('rent-inexistente', 'uid-1', 'comp-1', 'branch-1', 1)),
    ).rejects.toThrow(NotFoundException);
  });
});
