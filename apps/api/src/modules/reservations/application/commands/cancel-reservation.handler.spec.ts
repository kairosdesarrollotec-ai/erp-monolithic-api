import { NotFoundException } from '@nestjs/common';
import { CancelReservationHandler } from './cancel-reservation.handler';
import { CancelReservationCommand } from './cancel-reservation.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
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

function buildDeps(existing: ReservationRecord | null) {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(existing),
    list: jest.fn(),
    findCustomerById: jest.fn(),
    findVehicleById: jest.fn(),
    findInquiryById: jest.fn(),
    registerPayment: jest.fn(),
    registerDocuments: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn().mockResolvedValue(existing ? { ...existing, status: 'CANCELLED', version: existing.version + 1 } : undefined),
  };
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role: 'FRONT_OFFICE' }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
  };
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };
  return { reservations, workContext, audit, transactionManager };
}

describe('CancelReservationHandler', () => {
  it('cancela por cambio solicitado por el cliente y audita la razon (BR-RES-003)', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new CancelReservationHandler(reservations, workContext, audit, transactionManager);

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
    expect(result.status).toBe('CANCELLED');
  });

  it('busca la reserva por el scope completo antes de cancelar', async () => {
    const existing = buildRecord();
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new CancelReservationHandler(reservations, workContext, audit, transactionManager);

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
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new CancelReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'NO_SHOW')),
    ).rejects.toBeInstanceOf(ReservationStateConflictError);
    expect(reservations.cancel).not.toHaveBeenCalled();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext, audit, transactionManager } = buildDeps(null);
    const handler = new CancelReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new CancelReservationCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1, 'NO_SHOW')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
