import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormalizeContractHandler } from './formalize-contract.handler';
import { FormalizeContractCommand } from './formalize-contract.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError } from '../../domain/rental-errors';
import { testRole } from '../../../users/testing/role-fixtures';

describe('FormalizeContractHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-500',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Luis Vargas',
    customerDocNumber: '22334455',
    vehicleId: 'veh-1',
    vehiclePlate: 'JKL-004',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Yaris',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'CONTRACTING',
    startAt: new Date(),
    expectedEndAt: new Date(Date.now() + 86400000),
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-user',
    updatedAt: new Date(),
    updatedBy: 'uid-user',
    version: 4,
  };

  const fakeTx = {} as any;

  function buildDeps(templateOwned = true, activeTemplate: { id: string; version: number } | null = { id: 'tpl-active', version: 1 }) {
    const rentals = {
      findById: jest.fn().mockResolvedValue(fakeRental),
      contractTemplateBelongsToCompany: jest.fn().mockResolvedValue(templateOwned),
      findActiveContractTemplate: jest.fn().mockResolvedValue(activeTemplate),
      formalizeContract: jest.fn().mockResolvedValue({ ...fakeRental, status: 'PENDING_DELIVERY', version: 5 }),
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
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository };
  }

  it('template pertenece a la empresa → transiciona a PENDING_DELIVERY y publica ContratoFirmado.v1 y PagoRegistrado.v1', async () => {
    const deps = buildDeps(true);
    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const result = await handler.execute(
      new FormalizeContractCommand(
        'rent-500',
        'uid-1',
        'comp-1',
        'branch-1',
        4,
        'tpl-v1',
        'doc-ref-001',
        '500.00',
        'PEN',
      ),
    );

    expect(result.status).toBe('PENDING_DELIVERY');
    expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-500', templateVersionId: 'tpl-v1', depositAmount: '500.00' }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CONTRACT_FORMALIZED' }),
      fakeTx,
    );
    const publishCalls = deps.outboxRepository.publish.mock.calls.map((c) => c[0].eventType);
    expect(publishCalls).toContain('ContratoFirmado.v1');
    expect(publishCalls).toContain('PagoRegistrado.v1');
  });

  it('template NO pertenece a la empresa → BadRequestException con code INVALID_CONTRACT_TEMPLATE', async () => {
    const deps = buildDeps(false);
    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-500',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-ajena',
          'doc-ref-001',
          '500.00',
          'PEN',
        ),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-500',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-ajena',
          'doc-ref-001',
          '500.00',
          'PEN',
        ),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_CONTRACT_TEMPLATE' }) });
  });

  it('monto deposito <= 0 → BadRequestException con code INVALID_DEPOSIT_AMOUNT', async () => {
    const deps = buildDeps(true);
    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-500',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-v1',
          'doc-ref-001',
          '0',
          'PEN',
        ),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-500',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-v1',
          'doc-ref-001',
          '-50',
          'PEN',
        ),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_DEPOSIT_AMOUNT' }) });
  });

  it('estado distinto de CONTRACTING → RentalStateConflictError', async () => {
    const deps = buildDeps(true);
    deps.rentals.findById.mockResolvedValue({ ...fakeRental, status: 'DRAFT' });

    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-500',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-v1',
          'doc-ref-001',
          '500.00',
          'PEN',
        ),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('templateVersionId omitido → resuelve automaticamente la plantilla ACTIVE vigente', async () => {
    const deps = buildDeps(true, { id: 'tpl-auto', version: 3 });
    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await handler.execute(
      new FormalizeContractCommand('rent-500', 'uid-1', 'comp-1', 'branch-1', 4, undefined, 'doc-ref-001', '500.00', 'PEN'),
    );

    expect(deps.rentals.findActiveContractTemplate).toHaveBeenCalledWith('comp-1', 'RENTAL_CONTRACT');
    expect(deps.rentals.contractTemplateBelongsToCompany).not.toHaveBeenCalled();
    expect(deps.rentals.formalizeContract).toHaveBeenCalledWith(
      expect.objectContaining({ templateVersionId: 'tpl-auto' }),
      fakeTx,
    );
  });

  it('templateVersionId omitido y sin plantilla ACTIVE → BadRequestException con code NO_ACTIVE_CONTRACT_TEMPLATE', async () => {
    const deps = buildDeps(true, null);
    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new FormalizeContractCommand('rent-500', 'uid-1', 'comp-1', 'branch-1', 4, undefined, 'doc-ref-001', '500.00', 'PEN'),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'NO_ACTIVE_CONTRACT_TEMPLATE' }) });
  });

  it('alquiler no encontrado → NotFoundException', async () => {
    const deps = buildDeps(true);
    deps.rentals.findById.mockResolvedValue(null);

    const handler = new FormalizeContractHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new FormalizeContractCommand(
          'rent-inexistente',
          'uid-1',
          'comp-1',
          'branch-1',
          4,
          'tpl-v1',
          'doc-ref-001',
          '500.00',
          'PEN',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
