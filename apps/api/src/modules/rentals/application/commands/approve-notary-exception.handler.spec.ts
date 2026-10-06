import { BadRequestException } from '@nestjs/common';
import { ApproveNotaryExceptionHandler } from './approve-notary-exception.handler';
import { ApproveNotaryExceptionCommand } from './approve-notary-exception.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { ForbiddenException } from '@nestjs/common';

describe('ApproveNotaryExceptionHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-400',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Sofia Mendez',
    customerDocNumber: '11223344',
    vehicleId: 'veh-1',
    vehiclePlate: 'GHI-003',
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

  function buildDeps(role = 'GERENCIA') {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      findVehicleById: jest.fn().mockResolvedValue({
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        plate: 'GHI-003',
        brand: 'Nissan',
        model: 'Versa',
        status: 'RENTED',
      }),
      approveNotaryException: jest.fn().mockResolvedValue({ ...fakeRental, status: 'CONTRACTING', version: 4 }),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        role,
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

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  it('GERENCIA aprueba excepcion notarial y transiciona a CONTRACTING', async () => {
    const deps = buildDeps('GERENCIA');
    const handler = new ApproveNotaryExceptionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new ApproveNotaryExceptionCommand(
        'rent-400',
        'uid-gerencia',
        'comp-1',
        'branch-1',
        3,
        'Justificacion valida para excepcion notarial del cliente.',
      ),
    );

    expect(result.status).toBe('CONTRACTING');
    expect(deps.rentals.approveNotaryException).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rent-400', approvedBy: 'uid-gerencia' }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'NOTARY_EXCEPTION_APPROVED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ExcepcionNotarialAprobada.v1' }),
      fakeTx,
    );
  });

  it('rol sin permiso: MatrixAuthorizationService lanza error de autorizacion', async () => {
    const deps = buildDeps('FRONT_OFFICE');
    deps.matrixAuth.assertAllowed.mockRejectedValue(new ForbiddenException('Acceso denegado'));

    const handler = new ApproveNotaryExceptionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new ApproveNotaryExceptionCommand(
          'rent-400',
          'uid-front',
          'comp-1',
          'branch-1',
          3,
          'Intento no autorizado de aprobacion.',
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('estado distinto de NOTARY_EVALUATION lanza RentalStateConflictError', async () => {
    const deps = buildDeps('GERENCIA');
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'CONTRACTING' });

    const handler = new ApproveNotaryExceptionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new ApproveNotaryExceptionCommand(
          'rent-400',
          'uid-gerencia',
          'comp-1',
          'branch-1',
          3,
          'Justificacion valida pero estado incorrecto.',
        ),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('justificacion vacia o muy corta lanza BadRequestException con code JUSTIFICATION_REQUIRED', async () => {
    const deps = buildDeps('GERENCIA');
    const handler = new ApproveNotaryExceptionHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new ApproveNotaryExceptionCommand('rent-400', 'uid-gerencia', 'comp-1', 'branch-1', 3, 'corto'),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      handler.execute(
        new ApproveNotaryExceptionCommand('rent-400', 'uid-gerencia', 'comp-1', 'branch-1', 3, 'corto'),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'JUSTIFICATION_REQUIRED' }) });
  });
});
