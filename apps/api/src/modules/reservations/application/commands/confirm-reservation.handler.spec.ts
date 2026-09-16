import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfirmReservationHandler } from './confirm-reservation.handler';
import { ConfirmReservationCommand } from './confirm-reservation.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { RequirementsIncompleteError } from '../../domain/reservation-errors';

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

describe('ConfirmReservationHandler', () => {
  function buildDeps(
    existing: ReservationRecord | null,
    assignment: { organizationId: string; role: any } | null = { organizationId: 'org-1', role: 'FRONT_OFFICE' },
  ) {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing),
      list: jest.fn(),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn(),
      confirm: jest.fn().mockResolvedValue(existing ? { ...existing, status: 'CONFIRMED', version: existing.version + 1 } : undefined),
      cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    const audit: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn(),
      recordReservationEvent: jest.fn(),
    };
    return { reservations, workContext, audit };
  }

  it('confirma cuando pago y documentos estan ambos completos', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: new Date() });
    const { reservations, workContext, audit } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit);

    const result = await handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));

    expect(reservations.confirm).toHaveBeenCalledWith('res-1', 'org-1', 1);
    expect(audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CONFIRMED' }),
    );
    expect(result.status).toBe('CONFIRMED');
  });

  it('rechaza con REQUIREMENTS_INCOMPLETE si falta el pago', async () => {
    const existing = buildRecord({ paymentValidatedAt: null, documentsCompletedAt: new Date() });
    const { reservations, workContext, audit } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(RequirementsIncompleteError);
    expect(reservations.confirm).not.toHaveBeenCalled();
  });

  it('rechaza con REQUIREMENTS_INCOMPLETE si faltan los documentos', async () => {
    const existing = buildRecord({ paymentValidatedAt: new Date(), documentsCompletedAt: null });
    const { reservations, workContext, audit } = buildDeps(existing);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(RequirementsIncompleteError);
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext, audit } = buildDeps(null);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la combinacion empresa/sede no es valida', async () => {
    const { reservations, workContext, audit } = buildDeps(buildRecord(), null);
    const handler = new ConfirmReservationHandler(reservations, workContext, audit);

    await expect(
      handler.execute(new ConfirmReservationCommand('res-1', 'uid-1', 'company-ajena', 'branch-ajena', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
