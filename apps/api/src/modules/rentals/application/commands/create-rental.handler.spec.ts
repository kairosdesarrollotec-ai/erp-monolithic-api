import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateRentalHandler } from './create-rental.handler';
import { CreateRentalCommand } from './create-rental.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';

describe('CreateRentalHandler', () => {
  const fakeRental: RentalRecord = {
    id: 'rent-100',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Carlos Santillan',
    customerDocNumber: '44556677',
    vehicleId: 'veh-1',
    vehiclePlate: 'PER-999',
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

  const fakeTx = {} as any;

  function buildDeps() {
    const rentals = {
      findCustomerById: jest.fn().mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        fullName: 'Carlos Santillan',
        documentNumber: '44556677',
      }),
      findVehicleById: jest.fn().mockResolvedValue({
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        plate: 'PER-999',
        brand: 'Toyota',
        model: 'Corolla',
        status: 'AVAILABLE',
      }),
      create: jest.fn().mockResolvedValue(fakeRental),
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

  it('crea alquiler en DRAFT y publica RentalCreated.v1', async () => {
    const deps = buildDeps();
    const handler = new CreateRentalHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const startAt = new Date('2026-10-01T10:00:00Z');
    const expectedEndAt = new Date('2026-10-05T10:00:00Z');

    const result = await handler.execute(
      new CreateRentalCommand(
        'uid-1',
        'comp-1',
        'branch-1',
        'cust-1',
        'veh-1',
        'NORMAL',
        startAt,
        expectedEndAt,
      ),
    );

    expect(result.status).toBe('DRAFT');
    expect(deps.rentals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        customerId: 'cust-1',
        vehicleId: 'veh-1',
      }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RENTAL_CREATED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'RentalCreated.v1' }),
      fakeTx,
    );
  });

  it('falla si el cliente no existe en la empresa', async () => {
    const deps = buildDeps();
    deps.rentals.findCustomerById.mockResolvedValueOnce(null);

    const handler = new CreateRentalHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new CreateRentalCommand('uid-1', 'comp-1', 'branch-1', 'cust-inexistente', 'veh-1'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('falla si el vehiculo no existe en la empresa', async () => {
    const deps = buildDeps();
    deps.rentals.findVehicleById.mockResolvedValueOnce(null);

    const handler = new CreateRentalHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    await expect(
      handler.execute(
        new CreateRentalCommand('uid-1', 'comp-1', 'branch-1', 'cust-1', 'veh-inexistente'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('falla si la fecha de inicio es posterior o igual a la de fin', async () => {
    const deps = buildDeps();
    const handler = new CreateRentalHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );

    const startAt = new Date('2026-10-05T10:00:00Z');
    const expectedEndAt = new Date('2026-10-01T10:00:00Z');

    await expect(
      handler.execute(
        new CreateRentalCommand(
          'uid-1',
          'comp-1',
          'branch-1',
          'cust-1',
          'veh-1',
          'NORMAL',
          startAt,
          expectedEndAt,
        ),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
