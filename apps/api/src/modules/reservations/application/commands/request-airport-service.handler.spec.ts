import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestReservationAirportServiceHandler } from './request-airport-service.handler';
import { RequestReservationAirportServiceCommand } from './request-airport-service.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { AirportServiceRepositoryPort } from '../ports/airport-service-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { DomainConflictError } from '../../../../common/domain/domain-errors';
import { ReservationVersionConflictError } from '../../domain/reservation-errors';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1',
    organizationId: 'org-1',
    operatingCompanyId: 'company-1',
    branchId: 'branch-1',
    inquiryId: 'inq-1',
    customerId: 'cust-1',
    customerName: 'Juan Perez',
    vehicleId: 'veh-1',
    vehiclePlate: 'XYZ-987',
    vehicleLabel: 'Toyota Hilux - XYZ-987',
    status: 'CONFIRMED',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-10-27T10:00:00Z'),
    endAt: new Date('2026-10-29T10:00:00Z'),
    requiredPaymentAmount: '300.00',
    currency: 'PEN',
    paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(),
    documentsCompletedAt: new Date(),
    confirmedAt: new Date(),
    createdAt: new Date(),
    createdBy: 'uid-1',
    version: 2,
    ...overrides,
  };
}

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'GERENCIA') {
  const reservations = {
    findById: jest.fn().mockResolvedValue(existing),
    incrementVersion: jest.fn().mockImplementation(async () => ({ ...existing, version: (existing?.version ?? 0) + 1 })),
  } as unknown as jest.Mocked<ReservationRepositoryPort>;

  const airportServices = {
    findByTarget: jest.fn().mockResolvedValue(null),
    recordAirportService: jest.fn().mockImplementation(async (params) => ({
      id: 'apt-1',
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
      assertReservationRoleAllowed(roleKeyOfTestRoleId(roleId), action);
    }),
  } as unknown as MatrixAuthorizationService;

  const audit = { recordReservationEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  const handler = new RequestReservationAirportServiceHandler(
    reservations,
    airportServices,
    workContext,
    matrixAuth,
    audit,
    outbox,
    transactionManager,
  );

  return { handler, reservations, airportServices, matrixAuth, audit, outbox, transactionManager };
}

describe('RequestReservationAirportServiceHandler (C1, EX-RES-003)', () => {
  const scheduledAt = new Date('2026-10-27T10:00:00Z');

  it('registra la solicitud de aeropuerto, incrementa versión, audita y emite outbox', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'GERENCIA');

    const result = await deps.handler.execute(
      new RequestReservationAirportServiceCommand(
        'res-1',
        'uid-gerente',
        'company-1',
        'branch-1',
        2,
        scheduledAt,
        'Aeropuerto Coronel FAP Alfredo Mendivil Duarte',
        '50.00',
        'Vuelo LATAM 2145',
      ),
    );

    expect(result.id).toBe('apt-1');
    expect(result.additionalAmount).toBe('50.00');
    expect(deps.airportServices.recordAirportService).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'RESERVATION',
        targetId: 'res-1',
        location: 'Aeropuerto Coronel FAP Alfredo Mendivil Duarte',
        additionalAmount: '50.00',
        notes: 'Vuelo LATAM 2145',
      }),
      FAKE_TX,
    );
    expect(deps.reservations.incrementVersion).toHaveBeenCalledWith(
      'res-1',
      expect.objectContaining({ organizationId: 'org-1' }),
      2,
      FAKE_TX,
    );
    expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESERVATION_AIRPORT_SERVICE_REQUESTED',
        changes: expect.objectContaining({
          airportServiceId: 'apt-1',
          additionalAmount: '50.00',
        }),
      }),
      FAKE_TX,
    );
    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ReservationAirportServiceRequested.v1',
      }),
      FAKE_TX,
    );
  });

  it('permite que ADMINISTRACION solicite el servicio de aeropuerto', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'ADMINISTRACION');

    const result = await deps.handler.execute(
      new RequestReservationAirportServiceCommand(
        'res-1',
        'uid-admin',
        'company-1',
        'branch-1',
        2,
        scheduledAt,
        'Aeropuerto Ayacucho',
        '40.00',
      ),
    );

    expect(result.id).toBe('apt-1');
  });

  it('rechaza con 403 ForbiddenException si el rol es FRONT_OFFICE', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE');

    await expect(
      deps.handler.execute(
        new RequestReservationAirportServiceCommand(
          'res-1',
          'uid-front',
          'company-1',
          'branch-1',
          2,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '40.00',
        ),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(deps.airportServices.recordAirportService).not.toHaveBeenCalled();
  });

  it('rechaza con ReservationVersionConflictError si la versión no coincide', async () => {
    const record = buildRecord({ version: 5 });
    const deps = buildDeps(record, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestReservationAirportServiceCommand(
          'res-1',
          'uid-gerente',
          'company-1',
          'branch-1',
          2,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '40.00',
        ),
      ),
    ).rejects.toThrow(ReservationVersionConflictError);
  });

  it('rechaza con DomainConflictError si la reserva está CANCELLED', async () => {
    const record = buildRecord({ status: 'CANCELLED' });
    const deps = buildDeps(record, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestReservationAirportServiceCommand(
          'res-1',
          'uid-gerente',
          'company-1',
          'branch-1',
          2,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '40.00',
        ),
      ),
    ).rejects.toThrow(DomainConflictError);
  });

  it('rechaza con NotFoundException si la reserva no existe', async () => {
    const deps = buildDeps(null, 'GERENCIA');

    await expect(
      deps.handler.execute(
        new RequestReservationAirportServiceCommand(
          'res-inexistente',
          'uid-gerente',
          'company-1',
          'branch-1',
          1,
          scheduledAt,
          'Aeropuerto Ayacucho',
          '40.00',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
