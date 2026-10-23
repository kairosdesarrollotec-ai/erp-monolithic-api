import { NotFoundException } from '@nestjs/common';
import { ValidateDocumentsHandler } from './validate-documents.handler';
import { ValidateDocumentsCommand } from './validate-documents.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RentalDocumentsIncompleteError, RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

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
      // Cliente peruano por defecto (DNI); los tests de extranjero lo sobreescriben.
      findCustomerById: jest.fn().mockResolvedValue({
        id: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'Maria Lopez', documentNumber: '99887766',
        documentType: 'DNI', status: 'NORMAL', nationality: 'PERUANO', countryEntryDate: null,
      }),
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
        passportValid: false,
        foreignerCardValid: false,
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
          passportValid: false,
          foreignerCardValid: false,
          driverLicenseValid: true,
          addressOrStayProofValid: true,
        }),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  const buildHandler = (deps: ReturnType<typeof buildDeps>) =>
    new ValidateDocumentsHandler(deps.rentals, deps.workContext, deps.matrixAuth, deps.transactionManager, deps.auditRepository);

  it('peruano sin recibo de agua/luz validado -> 422 DOCUMENTS_INCOMPLETE con missingDocuments y requiredDocuments (el comprobante de domicilio es obligatorio)', async () => {
    const deps = buildDeps();
    const error = await buildHandler(deps)
      .execute(
        new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, {
          identityDocumentValid: true,
          passportValid: false,
          foreignerCardValid: false,
          driverLicenseValid: true,
          addressOrStayProofValid: false,
        }),
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RentalDocumentsIncompleteError);
    expect((error as RentalDocumentsIncompleteError).code).toBe('DOCUMENTS_INCOMPLETE');
    expect((error as RentalDocumentsIncompleteError).extra).toMatchObject({
      missingDocuments: ['Recibo de agua o luz'],
      requiredDocuments: ['DNI', 'LICENCIA_CONDUCIR', 'RECIBO_AGUA_LUZ'],
    });
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('extranjero: exige pasaporte, CE, licencia, constancia de hospedaje y fecha de ingreso (dato del cliente)', async () => {
    const deps = buildDeps();
    deps.rentals.findCustomerById.mockResolvedValue({
      id: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'John Smith', documentNumber: 'P123',
      documentType: 'PASAPORTE', status: 'NORMAL', nationality: 'EXTRANJERO', countryEntryDate: null,
    });
    const full = { identityDocumentValid: false, passportValid: true, foreignerCardValid: true, driverLicenseValid: true, addressOrStayProofValid: true };

    const noEntryDate = await buildHandler(deps)
      .execute(new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, full))
      .catch((e: unknown) => e);
    expect(noEntryDate).toBeInstanceOf(RentalDocumentsIncompleteError);
    expect((noEntryDate as RentalDocumentsIncompleteError).extra).toMatchObject({ missingDocuments: ['Fecha de ingreso al país'] });

    deps.rentals.findCustomerById.mockResolvedValue({
      id: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'John Smith', documentNumber: 'P123',
      documentType: 'PASAPORTE', status: 'NORMAL', nationality: 'EXTRANJERO', countryEntryDate: new Date('2026-10-01'),
    });
    const ok = await buildHandler(deps).execute(new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, full));
    expect(ok.status).toBe('VALIDATION');

    const noProof = await buildHandler(deps)
      .execute(new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, { ...full, addressOrStayProofValid: false }))
      .catch((e: unknown) => e);
    expect((noProof as RentalDocumentsIncompleteError).extra).toMatchObject({ missingDocuments: ['Constancia de hospedaje'] });
  });

  it('cliente inexistente -> 404 CUSTOMER_NOT_FOUND', async () => {
    const deps = buildDeps();
    deps.rentals.findCustomerById.mockResolvedValue(null);
    await expect(
      buildHandler(deps).execute(new ValidateDocumentsCommand('rent-200', 'uid-1', 'comp-1', 'branch-1', 1, { identityDocumentValid: true, passportValid: false, foreignerCardValid: false, driverLicenseValid: true, addressOrStayProofValid: true })),
    ).rejects.toThrow(NotFoundException);
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
      handler.execute(new ValidateDocumentsCommand('rent-inexistente', 'uid-1', 'comp-1', 'branch-1', 1, { identityDocumentValid: true, passportValid: false, foreignerCardValid: false, driverLicenseValid: true, addressOrStayProofValid: true })),
    ).rejects.toThrow(NotFoundException);
  });
});
