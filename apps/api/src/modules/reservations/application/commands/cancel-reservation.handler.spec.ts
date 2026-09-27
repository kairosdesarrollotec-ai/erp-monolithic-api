import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CancelReservationHandler } from './cancel-reservation.handler';
import { CancelReservationCommand } from './cancel-reservation.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { assertReservationRoleAllowed } from '../policies/reservation-role-policy';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { ReservationStateConflictError } from '../../domain/reservation-errors';

function buildRecord(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1',
    organizationId: 'org-1',
    operatingCompanyId: 'company-1',
    branchId: 'branch-1',
    inquiryId: 'inq-1',
    customerId: 'cust-1',
    customerName: 'Maria Quispe',
    vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704',
    vehicleLabel: 'Toyota Hilux - D0Y-704',
    status: 'CONFIRMED',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-09-20T14:00:00Z'),
    endAt: new Date('2026-09-22T14:00:00Z'),
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

const SCOPE: ReservationScope = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };
const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, role = 'FRONT_OFFICE') {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    findCustomerById: jest.fn(),
    findVehicleById: jest.fn(),
    isVehicleAvailable: jest.fn(),
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(existing),
    list: jest.fn(),
    registerPayment: jest.fn(),
    registerDocuments: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn().mockResolvedValue(existing ? { ...existing, status: 'CANCELLED', version: existing.version + 1 } : undefined),
  };
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
  };
  const outbox: jest.Mocked<OutboxEventRepositoryPort> = {
    publish: jest.fn(),
  };
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };
  const matrixAuth = {
    assertAllowed: jest.fn().mockImplementation(async (_orgId, r, _mod, action) => {
      assertReservationRoleAllowed(r, action);
    }),
    isAllowed: jest.fn().mockResolvedValue(true),
  } as unknown as MatrixAuthorizationService;
  return { reservations, workContext, audit, outbox, transactionManager, matrixAuth };
}

describe('CancelReservationHandler', () => {
  it('cancela por cambio solicitado por el cliente y audita la razon (BR-RES-003)', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing);
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    const result = await handler.execute(
      new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'CUSTOMER_REQUESTED_CHANGE', 'Cambio de fecha'),
    );

    expect(reservations.cancel).toHaveBeenCalledWith(
      {
        id: 'res-1',
        organizationId: 'org-1',
        operatingCompanyId: 'company-1',
        branchId: 'branch-1',
        expectedVersion: 2,
        reason: 'CUSTOMER_REQUESTED_CHANGE',
        note: 'Cambio de fecha',
      },
      FAKE_TX,
    );
    expect(audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CANCELLED_FOR_CHANGE', actorUserId: 'uid-1' }),
      FAKE_TX,
    );
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'Reservation', aggregateId: 'res-1', eventType: 'ReservationCancelled' }),
      FAKE_TX,
    );
    expect(result.status).toBe('CANCELLED');
  });

  it('busca la reserva por el scope completo antes de cancelar', async () => {
    const existing = buildRecord();
    // NO_SHOW solo lo puede ejecutar Gerencia (ver reservation-role-policy.ts) - GERENCIA aqui.
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing, 'GERENCIA');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await handler.execute(new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'NO_SHOW'));

    expect(reservations.findById).toHaveBeenCalledWith('res-1', SCOPE);
  });

  /**
   * Hallazgo alto "maquina de estados incompleta": CANCELLED y CONVERTED
   * son terminales - no se puede volver a cancelar una reserva ya
   * cancelada o convertida a alquiler.
   */
  it.each(['CANCELLED', 'CONVERTED'] as const)('rechaza cancelar una reserva ya %s (estado terminal)', async (status) => {
    const existing = buildRecord({ status });
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing, 'GERENCIA');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await expect(
      handler.execute(new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'NO_SHOW')),
    ).rejects.toBeInstanceOf(ReservationStateConflictError);
    expect(reservations.cancel).not.toHaveBeenCalled();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(null, 'GERENCIA');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await expect(
      handler.execute(new CancelReservationCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1, 'NO_SHOW')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion") -
  // MATRIZ-TRAZABILIDAD-COMPLETA.md fila RES-08: cancelacion por no-show
  // es la unica accion de Reserva restringida a un solo rol (Gerencia).
  it('rechaza cancelar por no-show si el rol autorizado no es Gerencia', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing, 'FRONT_OFFICE');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await expect(
      handler.execute(new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'NO_SHOW')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.cancel).not.toHaveBeenCalled();
  });

  it('permite cancelar por cambio solicitado por el cliente con rol Front-office (no requiere Gerencia)', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing, 'FRONT_OFFICE');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    const result = await handler.execute(
      new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'CUSTOMER_REQUESTED_CHANGE'),
    );

    expect(result.status).toBe('CANCELLED');
  });

  it('rechaza cancelar si la matriz personalizada versionada revoca CANCEL_CUSTOMER_REQUESTED_CHANGE', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, outbox, transactionManager } = buildDeps(existing, 'FRONT_OFFICE');
    const matrixAuth = {
      assertAllowed: jest.fn().mockRejectedValue(
        new ForbiddenException({
          code: 'ROLE_NOT_ALLOWED',
          detail: 'El rol FRONT_OFFICE no tiene permiso para realizar la accion CANCEL_CUSTOMER_REQUESTED_CHANGE sobre una Reserva segun la matriz vigente (version 2).',
        }),
      ),
      isAllowed: jest.fn().mockResolvedValue(false),
    } as unknown as MatrixAuthorizationService;

    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await expect(
      handler.execute(
        new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'CUSTOMER_REQUESTED_CHANGE'),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ROLE_NOT_ALLOWED',
      },
    });
    expect(reservations.cancel).not.toHaveBeenCalled();
  });

  it('rechaza cualquier cancelacion si el rol autorizado no esta en la matriz de Reserva', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, outbox, transactionManager, matrixAuth } = buildDeps(existing, 'AUDITORIA');
    const handler = new CancelReservationHandler(reservations, workContext, audit, outbox, transactionManager, matrixAuth);

    await expect(
      handler.execute(new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'CUSTOMER_REQUESTED_CHANGE')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.cancel).not.toHaveBeenCalled();
  });
});
