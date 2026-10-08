import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateRentalHandler } from './create-rental.handler';
import { CreateRentalCommand } from './create-rental.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { RentalCreationGuard } from '../services/rental-creation.guard';
import { CustomerBlockedError, RentalInquiryNotFoundError, VehicleNotAvailableForRentalError } from '../../domain/rental-errors';
import { InquiryNotTransitionableError } from '../../../inquiries/domain/inquiry-errors';
import { testRole } from '../../../users/testing/role-fixtures';

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
        status: 'NORMAL',
      }),
      findVehicleById: jest.fn().mockResolvedValue({
        id: 'veh-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        plate: 'PER-999',
        brand: 'Toyota',
        model: 'Corolla',
        status: 'AVAILABLE',
      }),
      create: jest.fn().mockResolvedValue(fakeRental),
      hasBlockingVehicleCommitment: jest.fn().mockResolvedValue(false),
      findInquiryForRental: jest.fn().mockResolvedValue({
        id: 'inq-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        customerId: 'cust-1',
        status: 'COTIZADA',
        quotations: [{ id: 'q-1', vehicleId: 'veh-1', estimatedDays: 3, validUntil: new Date(), createdAt: new Date() }],
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
    };

    const outboxRepository: jest.Mocked<OutboxEventRepositoryPort> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const clock: ClockPort = { now: () => new Date('2026-10-05T15:00:00Z') };
    const creationGuard = new RentalCreationGuard(rentals, clock);

    return { rentals, workContext, matrixAuth, transactionManager, auditRepository, outboxRepository, creationGuard };
  }

  function buildHandler(deps: ReturnType<typeof buildDeps>) {
    return new CreateRentalHandler(
      deps.rentals,
      deps.workContext,
      deps.matrixAuth,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
      deps.creationGuard,
    );
  }

  it('crea alquiler en DRAFT y publica RentalCreated.v1', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

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

    const handler = buildHandler(deps);

    await expect(
      handler.execute(
        new CreateRentalCommand('uid-1', 'comp-1', 'branch-1', 'cust-inexistente', 'veh-1'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('falla si el vehiculo no existe en la empresa', async () => {
    const deps = buildDeps();
    deps.rentals.findVehicleById.mockResolvedValueOnce(null);

    const handler = buildHandler(deps);

    await expect(
      handler.execute(
        new CreateRentalCommand('uid-1', 'comp-1', 'branch-1', 'cust-1', 'veh-inexistente'),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('falla si la fecha de inicio es posterior o igual a la de fin', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

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

  describe('endurecimiento (ALQ-02, DT-ALQ-05)', () => {
    const create = (deps: ReturnType<typeof buildDeps>, inquiryId?: string, startAt?: Date, expectedEndAt?: Date) =>
      buildHandler(deps).execute(
        new CreateRentalCommand('uid-1', 'comp-1', 'branch-1', 'cust-1', 'veh-1', 'NORMAL', startAt, expectedEndAt, inquiryId),
      );

    it('cliente ROJO -> CUSTOMER_BLOCKED y no crea el alquiler', async () => {
      const deps = buildDeps();
      deps.rentals.findCustomerById.mockResolvedValueOnce({
        id: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'X', documentNumber: '1', status: 'ROJO',
      });
      await expect(create(deps)).rejects.toBeInstanceOf(CustomerBlockedError);
      expect(deps.rentals.create).not.toHaveBeenCalled();
    });

    it('cliente en AMBAR (observado, no persistido como estado propio) no bloquea', async () => {
      const deps = buildDeps();
      deps.rentals.findCustomerById.mockResolvedValueOnce({
        id: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', fullName: 'X', documentNumber: '1', status: 'AMBAR',
      });
      await expect(create(deps)).resolves.toBeDefined();
    });

    it.each([
      ['STATUS', { status: 'RENTED', branchId: 'branch-1' }],
      ['BRANCH', { status: 'AVAILABLE', branchId: 'branch-otra' }],
    ])('vehiculo no disponible (%s) -> VEHICLE_NOT_AVAILABLE', async (reason, patch) => {
      const deps = buildDeps();
      deps.rentals.findVehicleById.mockResolvedValueOnce({
        id: 'veh-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', plate: 'P', brand: 'T', model: 'C', ...patch,
      });
      await expect(create(deps)).rejects.toMatchObject({ code: 'VEHICLE_NOT_AVAILABLE', extra: { reason } });
      expect(deps.rentals.create).not.toHaveBeenCalled();
    });

    it('vehiculo compartido entre sedes (branchId null) es elegible', async () => {
      const deps = buildDeps();
      deps.rentals.findVehicleById.mockResolvedValueOnce({
        id: 'veh-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: null, plate: 'P', brand: 'T', model: 'C', status: 'AVAILABLE',
      });
      await expect(create(deps)).resolves.toBeDefined();
    });

    it('solape con reserva/compromiso en el periodo pedido -> VEHICLE_NOT_AVAILABLE', async () => {
      const deps = buildDeps();
      deps.rentals.hasBlockingVehicleCommitment.mockResolvedValueOnce(true);
      const startAt = new Date('2026-10-01T10:00:00Z');
      const endAt = new Date('2026-10-05T10:00:00Z');
      await expect(create(deps, undefined, startAt, endAt)).rejects.toBeInstanceOf(VehicleNotAvailableForRentalError);
      expect(deps.rentals.hasBlockingVehicleCommitment).toHaveBeenCalledWith('veh-1', 'org-1', startAt, endAt, fakeTx);
    });

    it('sin fechas pero con inquiryId, el periodo a validar es ahora + dias de la cotizacion', async () => {
      const deps = buildDeps();
      await create(deps, 'inq-1');
      expect(deps.rentals.hasBlockingVehicleCommitment).toHaveBeenCalledWith(
        'veh-1',
        'org-1',
        new Date('2026-10-05T15:00:00Z'),
        new Date('2026-10-08T15:00:00Z'),
        fakeTx,
      );
    });

    it('inquiryId COTIZADA de la misma empresa -> crea el alquiler vinculado', async () => {
      const deps = buildDeps();
      await create(deps, 'inq-1');
      expect(deps.rentals.create).toHaveBeenCalledWith(expect.objectContaining({ inquiryId: 'inq-1' }), fakeTx);
    });

    it('inquiryId inexistente -> INQUIRY_NOT_FOUND', async () => {
      const deps = buildDeps();
      deps.rentals.findInquiryForRental.mockResolvedValueOnce(null);
      await expect(create(deps, 'inq-x')).rejects.toBeInstanceOf(RentalInquiryNotFoundError);
    });

    it('inquiryId de otra empresa -> INQUIRY_NOT_FOUND (aislamiento multi-tenant)', async () => {
      const deps = buildDeps();
      deps.rentals.findInquiryForRental.mockResolvedValueOnce({
        id: 'inq-1', organizationId: 'org-1', operatingCompanyId: 'comp-OTRA', branchId: 'b', customerId: 'c', status: 'COTIZADA', quotations: [],
      });
      await expect(create(deps, 'inq-1')).rejects.toBeInstanceOf(RentalInquiryNotFoundError);
      expect(deps.rentals.create).not.toHaveBeenCalled();
    });

    it.each(['REGISTRADA', 'CONVERTIDA', 'CERRADA_SIN_CONVERSION'])('inquiryId en estado %s -> INQUIRY_NOT_TRANSITIONABLE', async (status) => {
      const deps = buildDeps();
      deps.rentals.findInquiryForRental.mockResolvedValueOnce({
        id: 'inq-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'b', customerId: 'c', status, quotations: [],
      });
      await expect(create(deps, 'inq-1')).rejects.toBeInstanceOf(InquiryNotTransitionableError);
      expect(deps.rentals.create).not.toHaveBeenCalled();
    });
  });
});
