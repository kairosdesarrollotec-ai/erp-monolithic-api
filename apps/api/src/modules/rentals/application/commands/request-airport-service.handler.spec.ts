import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestRentalAirportServiceHandler } from './request-airport-service.handler';
import { RequestRentalAirportServiceCommand } from './request-airport-service.command';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { AirportServiceRepositoryPort } from '../../../reservations/application/ports/airport-service-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertRentalRoleAllowed } from '../policies/rental-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { RentalStateConflictError, RentalVersionConflictError } from '../../domain/rental-errors';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRentalRecord(overrides: Partial<RentalRecord> = {}): RentalRecord {
  return {
    id: 'rent-1',
    organizationId: 'org-1',
    operatingCompanyId: 'company-1',
    branchId: 'branch-1',
    inquiryId: null,
    reservationId: null,
    customerId: 'cust-1',
    customerName: 'Carlos Benitez',
    customerDocNumber: '12345678',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Hilux',
    vehicleDepositMinimum: null,
    planCode: 'NORMAL',
    status: 'ACTIVE',
    startAt: new Date('2026-10-26T10:00:00Z'),
    expectedEndAt: new Date('2026-10-28T10:00:00Z'),
    alcoholTestResult: 'FAVORABLE',
    createdAt: new Date(),
    createdBy: 'uid-1',
    updatedAt: new Date(),
    updatedBy: 'uid-1',
    version: 3,
    ...overrides,
  };
}

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: RentalRecord | null, role = 'GERENCIA') {
  const rentals = {
    findById: jest.fn().mockResolvedValue(existing),
    incrementVersion: jest.fn().mockImplementation(async () => ({ ...existing, version: (existing?.version ?? 0) + 1 })),
  } as unknown as jest.Mocked<RentalRepositoryPort>;

  const airportServices = {
    findByTarget: jest.fn().mockResolvedValue(null),
    recordAirportService: jest.fn().mockImplementation(async (params) => ({
      id: 'apt-rent-1',
      organizationId: params.organizationId,
      operatingCompanyId: params.operatingCompanyId,
      branchId: params.branchId,
      targetType: params.targetType,
      targetId: params.targetId,
      scheduledAt: params.scheduledAt,
      location: params.location,
      additionalAmount: params.additionalAmount,
      notes: params.notes ?? null,
      registeredBy: params.registeredBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  } as unknown as jest.Mocked<AirportServiceRepositoryPort>;

  const workContext = {
    authorize: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      ...testRole(role),
    }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_org, roleId, _mod, action) => {
      assertRentalRoleAllowed(roleKeyOfTestRoleId(roleId), action);
    }),
  } as unknown as MatrixAuthorizationService;

  const audit = { recordRentalEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  const handler = new RequestRentalAirportServiceHandler(
    rentals,
    airportServices,
    workContext,
    matrixAuth,
    audit,
    outbox,
    transactionManager,
  );

  return { handler, rentals, airportServices, matrixAuth, audit, outbox, transactionManager };
}

describe('RequestRentalAirportServiceHandler (C1, BDD-ALQ 7.1.1)', () => {
  const scheduledAt = new Date('2026-10-27T14:00:00Z');

  it('registra solicitud de aeropuerto para un alquiler, incrementa version, audita y emite outbox', async () => {
    const record = buildRentalRecord();
    const deps = buildDeps(record, 'GERENCIA');

    const result = await deps.handler.execute(
      new RequestRentalAirportServiceCommand(
        'rent-1',
        'uid-gerente',
        'company-1',
        'branch-1',
        3,
        scheduledAt,
        'Aeropuerto Alfredo Mendivil Duarte',
        '60.00',
        'Entrega en puerta principal',
      ),
    );

    expect(result.id).toBe('apt-rent-1');
    expect(result.additionalAmount).toBe('60.00');
    expect(deps.airportServices.recordAirportService).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'RENTAL',
        targetId: 'rent-1',
        location: 'Aeropuerto Alfredo Mendivil Duarte',
        additionalAmount: '60.00',
        notes: 'Entrega en puerta principal',
      }),
      FAKE_TX,
    );
    expect(deps.rentals.incrementVersion).toHaveBeenCalledWith(
      'rent-1',
      expect.objectContaining({ organizationId: 'org-1' }),
      3,
      FAKE_TX,
    );
    expect(deps.audit.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RENTAL_AIRPORT_SERVICE_REQUESTED',
        changes: expect.objectContaining({
          airportServiceId: 'apt-rent-1',
          additionalAmount: '60.00',
        }),
      }),
      FAKE_TX,
    );
    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'rental',
        eventType: 'RentalAirportServiceRequested.v1',
      }),
      FAKE_TX,
    );
  });

  it('permite que ADMINISTRACION solicite el servicio', async () => {
    const record = buildRentalRecord();
    const deps = buildDeps(record, 'ADMINISTRACION');

    const result = await deps.handler.execute(
      new RequestRentalAirportServiceCommand(
        'rent-1',
        'uid-admin',
        'company-1',
        'branch-1',
        3,
        scheduledAt,
        'Aeropuerto Ayacucho',
        '50.00',
      ),
    );

    expect(result.id).toBe('apt-rent-1');
  });

  it('rechaza con 403 ForbiddenException si el rol es FRONT_OFFICE', async () => {
    const record = buildRentalRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE');

    await expect(
      deps.handler.execute(
        new RequestRentalAirportServiceCommand(
          'rent-1',
          'uid-front',
          'company-1',
          'branch-1',
          3,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '50.00',
        ),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.airportServices.recordAirportService).not.toHaveBeenCalled();
  });

  it('rechaza con RentalVersionConflictError si la versión no coincide', async () => {
    const record = buildRentalRecord({ version: 5 });
    const deps = buildDeps(record, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestRentalAirportServiceCommand(
          'rent-1',
          'uid-gerente',
          'company-1',
          'branch-1',
          3,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '50.00',
        ),
      ),
    ).rejects.toThrow(RentalVersionConflictError);
  });

  it('rechaza con RentalStateConflictError si el alquiler está CANCELLED o CLOSED', async () => {
    const recordCancelled = buildRentalRecord({ status: 'CANCELLED' });
    const deps = buildDeps(recordCancelled, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestRentalAirportServiceCommand(
          'rent-1',
          'uid-gerente',
          'company-1',
          'branch-1',
          3,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '50.00',
        ),
      ),
    ).rejects.toThrow(RentalStateConflictError);
  });

  it('rechaza con NotFoundException si el alquiler no existe', async () => {
    const deps = buildDeps(null, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestRentalAirportServiceCommand(
          'rent-inexistente',
          'uid-gerente',
          'company-1',
          'branch-1',
          1,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '50.00',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
