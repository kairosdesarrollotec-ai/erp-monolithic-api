import { CancelReservationHandler } from './cancel-reservation.handler';
import { CancelReservationCommand } from './cancel-reservation.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';

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

describe('CancelReservationHandler', () => {
  it('cancela por cambio solicitado por el cliente y audita la razon (BR-RES-003)', async () => {
    const existing = buildRecord();
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(existing),
      list: jest.fn(),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn().mockResolvedValue({ ...existing, status: 'CANCELLED', version: 3 }),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const audit: jest.Mocked<AuditEventRepositoryPort> = {
      recordLoginAttempt: jest.fn(),
      recordWorkContextSelection: jest.fn(),
      recordReservationEvent: jest.fn(),
    };
    const handler = new CancelReservationHandler(reservations, workContext, audit);

    const result = await handler.execute(
      new CancelReservationCommand('res-1', 'uid-1', 'company-1', 'branch-1', 2, 'CUSTOMER_REQUESTED_CHANGE', 'Cambio de fecha'),
    );

    expect(reservations.cancel).toHaveBeenCalledWith({
      id: 'res-1',
      organizationId: 'org-1',
      expectedVersion: 2,
      reason: 'CUSTOMER_REQUESTED_CHANGE',
      note: 'Cambio de fecha',
    });
    expect(audit.recordReservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESERVATION_CANCELLED_FOR_CHANGE' }),
    );
    expect(result.status).toBe('CANCELLED');
  });
});
