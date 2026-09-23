import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfirmReservationHandler } from './confirm-reservation.handler';
import { ConfirmReservationCommand } from './confirm-reservation.command';
import { ReservationRepositoryPort, ReservationRecord, ReservationScope } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RequirementsIncompleteError, ReservationStateConflictError } from '../../domain/reservation-errors';

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
    status: 'DRAFT',
    channelMode: 'PRESENCIAL',
    startAt: new Date('2026-09-20T14:00:00Z'),
    endAt: new Date('2026-09-22T14:00:00Z'),
    requiredPaymentAmount: '300.00',
    currency: 'PEN',
    paymentPolicyVersion: 1,
    paymentValidatedAt: null,
    documentsCompletedAt: null,
    confirmedAt: null,
    createdAt: new Date(),
    createdBy: 'uid-1',
    version: 1,
    ...overrides,
  };
}

const SCOPE: ReservationScope = { organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1' };
const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(existing: ReservationRecord | null, forbidden = false, role = 'FRONT_OFFICE') {
  const reservations: jest.Mocked<ReservationRepositoryPort> = {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(existing),
    list: jest.fn(),
    registerPayment: jest.fn(),
    registerDocuments: jest.fn(),
    confirm: jest.fn().mockResolvedValue(existing ? { ...existing, status: 'CONFIRMED', version: existing.version + 1 } : undefined),
    cancel: jest.fn(),
  };
  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
  };
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };
  return { reservations, workContext, audit, transactionManager };
}

describe('ConfirmReservationHandler', () => {
  it('confirma cuando pago y documentos estan ambos completos', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: new Date() });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    const result = await handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));

    expect(reservations.confirm).toHaveBeenCalledWith('res-1', SCOPE, 1, FAKE_TX);
    expect(audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CONFIRMED', actorUserId: 'uid-1', organizationId: 'org-1' }),
      FAKE_TX,
    );
    expect(result.status).toBe('CONFIRMED');
  });

  /**
   * Hallazgo critico "cambio de estado y auditoria no son atomicos":
   * confirmar y auditar corren dentro de la misma transaccion abierta
   * por TransactionManagerPort.run, con aislamiento Serializable
   * (seccion 10.1 del TDD).
   */
  it('abre la transaccion con aislamiento Serializable', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: new Date() });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));

    expect(transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('rechaza con REQUIREMENTS_INCOMPLETE si falta el pago', async () => {
    const existing = buildRecord({ paymentValidatedAt: null, documentsCompletedAt: new Date() });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(RequirementsIncompleteError);
    expect(reservations.confirm).not.toHaveBeenCalled();
  });

  it('rechaza con REQUIREMENTS_INCOMPLETE si faltan los documentos', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: null });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(RequirementsIncompleteError);
  });

  it('rechaza si la reserva ya no esta en DRAFT (maquina de estados)', async () => {
    const existing = buildRecord({ status: 'CANCELLED', paymentValidatedAt: new Date(), documentsCompletedAt: new Date() });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ReservationStateConflictError);
    expect(reservations.confirm).not.toHaveBeenCalled();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext, audit, transactionManager } = buildDeps(null);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la combinacion empresa/sede no es valida', async () => {
    const { reservations, workContext, audit, transactionManager } = buildDeps(buildRecord(), true);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-ajena', 'branch-ajena', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Hallazgo ALTO PR#6 ("falta autorizacion granular por rol/accion").
  it('rechaza confirmar si el rol autorizado no esta en la matriz de Reserva', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: new Date() });
    const { reservations, workContext, audit, transactionManager } = buildDeps(existing, false, 'FINANZAS');
    const handler = new ConfirmReservationHandler(reservations, workContext, audit, transactionManager);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reservations.confirm).not.toHaveBeenCalled();
  });
});
