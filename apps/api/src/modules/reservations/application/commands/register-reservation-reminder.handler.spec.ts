import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterReservationReminderHandler } from './register-reservation-reminder.handler';
import { RegisterReservationReminderCommand } from './register-reservation-reminder.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { ReservationReminderRepositoryPort } from '../ports/reservation-reminder-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { DomainConflictError } from '../../../../common/domain/domain-errors';
import { ReservationVersionConflictError } from '../../domain/reservation-errors';
import { InvalidReservationReminderResultError } from '../../domain/reservation-reminder';
import { roleKeyOfTestRoleId, testRole } from '../../../users/testing/role-fixtures';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1',
    organizationId: 'org-1',
    operatingCompanyId: 'company-1',
    branchId: 'branch-1',
    inquiryId: 'inq-1',
    customerId: 'cust-1',
    customerName: 'Carlos Benitez',
    vehicleId: 'veh-1',
    vehiclePlate: 'ABC-123',
    vehicleLabel: 'Toyota Yaris - ABC-123',
    status: 'CONFIRMED',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-10-27T10:00:00Z'),
    endAt: new Date('2026-10-29T10:00:00Z'),
    requiredPaymentAmount: '200.00',
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

function buildDeps(existing: ReservationRecord | null, role = 'FRONT_OFFICE', fixedNow = new Date('2026-10-26T12:00:00Z')) {
  const reservations = {
    findById: jest.fn().mockResolvedValue(existing),
    incrementVersion: jest.fn().mockImplementation(async () => ({ ...existing, version: (existing?.version ?? 0) + 1 })),
  } as unknown as jest.Mocked<ReservationRepositoryPort>;

  const reminders = {
    registerReminder: jest.fn().mockImplementation(async (params) => ({
      id: 'rem-1',
      reservationId: params.reservationId,
      result: params.result,
      dueAt: params.dueAt,
      messageText: params.messageText,
      sentAt: params.sentAt,
      sentBy: params.sentBy,
      note: params.note,
      createdAt: fixedNow,
    })),
    findByReservationId: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<ReservationReminderRepositoryPort>;

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

  const clock: ClockPort = {
    now: () => fixedNow,
  };

  const audit = { recordReservationEvent: jest.fn() } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const outbox = { publish: jest.fn() } as unknown as jest.Mocked<OutboxEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  const handler = new RegisterReservationReminderHandler(
    reservations,
    reminders,
    workContext,
    matrixAuth,
    clock,
    audit,
    outbox,
    transactionManager,
  );

  return { handler, reservations, reminders, matrixAuth, clock, audit, outbox, transactionManager };
}

describe('RegisterReservationReminderHandler (C3, BR-RES-009)', () => {
  const fixedNow = new Date('2026-10-26T12:00:00Z');

  it('registra un recordatorio EXITOSO (SENT), incrementa versión, audita y emite outbox', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE', fixedNow);

    const result = await deps.handler.execute(
      new RegisterReservationReminderCommand(
        'res-1',
        'uid-front',
        'company-1',
        'branch-1',
        2,
        'SENT',
        fixedNow,
        'Cliente confirmó por WhatsApp',
      ),
    );

    expect(result.version).toBe(3);
    expect(deps.reminders.registerReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res-1',
        result: 'SENT',
        sentBy: 'uid-front',
        sentAt: fixedNow,
        note: 'Cliente confirmó por WhatsApp',
        messageText: expect.stringContaining('Carlos Benitez'),
      }),
      FAKE_TX,
    );
    expect(deps.reservations.incrementVersion).toHaveBeenCalledWith(
      'res-1',
      {
        organizationId: 'org-1',
        operatingCompanyId: 'company-1',
        branchId: 'branch-1',
      },
      2,
      FAKE_TX,
    );
    expect(deps.audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESERVATION_REMINDER_REGISTERED',
        changes: expect.objectContaining({
          reminderId: 'rem-1',
          result: 'SENT',
        }),
      }),
      FAKE_TX,
    );
    expect(deps.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ReservationReminderRegistered.v1',
      }),
      FAKE_TX,
    );
  });

  it('registra un recordatorio FALLIDO (FAILED) con nota obligatoria', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'ADMINISTRACION', fixedNow);

    const result = await deps.handler.execute(
      new RegisterReservationReminderCommand(
        'res-1',
        'uid-admin',
        'company-1',
        'branch-1',
        2,
        'FAILED',
        fixedNow,
        'Número no contesta ni entran llamadas',
      ),
    );

    expect(result.version).toBe(3);
    expect(deps.reminders.registerReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'FAILED',
        note: 'Número no contesta ni entran llamadas',
      }),
      FAKE_TX,
    );
  });

  it('falla con InvalidReservationReminderResultError si FAILED no incluye nota', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE', fixedNow);

    await expect(
      deps.handler.execute(
        new RegisterReservationReminderCommand(
          'res-1',
          'uid-front',
          'company-1',
          'branch-1',
          2,
          'FAILED',
          fixedNow,
          '   ',
        ),
      ),
    ).rejects.toThrow(InvalidReservationReminderResultError);

    expect(deps.reminders.registerReminder).not.toHaveBeenCalled();
  });

  it('falla con InvalidReservationReminderResultError si sentAt es en el futuro (> 5 min)', async () => {
    const record = buildRecord();
    const deps = buildDeps(record, 'FRONT_OFFICE', fixedNow);
    const futureDate = new Date(fixedNow.getTime() + 10 * 60 * 1000);

    await expect(
      deps.handler.execute(
        new RegisterReservationReminderCommand(
          'res-1',
          'uid-front',
          'company-1',
          'branch-1',
          2,
          'SENT',
          futureDate,
        ),
      ),
    ).rejects.toThrow(InvalidReservationReminderResultError);

    expect(deps.reminders.registerReminder).not.toHaveBeenCalled();
  });

  it('rechaza con ReservationVersionConflictError si la versión no coincide', async () => {
    const record = buildRecord({ version: 5 });
    const deps = buildDeps(record, 'FRONT_OFFICE', fixedNow);

    await expect(
      deps.handler.execute(
        new RegisterReservationReminderCommand(
          'res-1',
          'uid-front',
          'company-1',
          'branch-1',
          2,
          'SENT',
        ),
      ),
    ).rejects.toThrow(ReservationVersionConflictError);
  });

  it('rechaza con DomainConflictError si la reserva está CANCELLED o CONVERTED', async () => {
    const recordCancelled = buildRecord({ status: 'CANCELLED' });
    const deps = buildDeps(recordCancelled, 'FRONT_OFFICE', fixedNow);

    await expect(
      deps.handler.execute(
        new RegisterReservationReminderCommand(
          'res-1',
          'uid-front',
          'company-1',
          'branch-1',
          2,
          'SENT',
        ),
      ),
    ).rejects.toThrow(DomainConflictError);
  });

  it('rechaza con 404 NotFoundException si la reserva no existe', async () => {
    const deps = buildDeps(null, 'FRONT_OFFICE', fixedNow);

    await expect(
      deps.handler.execute(
        new RegisterReservationReminderCommand(
          'res-inexistente',
          'uid-front',
          'company-1',
          'branch-1',
          1,
          'SENT',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
