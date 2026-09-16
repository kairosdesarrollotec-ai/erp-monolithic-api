import { NotFoundException } from '@nestjs/common';
import { RegisterDocumentsHandler } from './register-documents.handler';
import { RegisterDocumentsCommand } from './register-documents.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';

function buildRecord(): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: 'inq-1', customerId: 'cust-1', customerName: 'Maria Quispe', vehicleId: 'veh-1',
    vehiclePlate: 'D0Y-704', vehicleLabel: 'Toyota Hilux - D0Y-704', status: 'DRAFT',
    channelMode: 'PRESENCIAL', startAt: new Date(), endAt: new Date(), requiredPaymentAmount: '300.00',
    currency: 'PEN', paymentPolicyVersion: 1, paymentValidatedAt: null, documentsCompletedAt: null,
    confirmedAt: null, createdAt: new Date(), createdBy: 'uid-1', version: 1,
  };
}

describe('RegisterDocumentsHandler', () => {
  it('marca documents_completed_at sin tocar disponibilidad', async () => {
    const existing = buildRecord();
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(existing), list: jest.fn(),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn().mockResolvedValue({ ...existing, documentsCompletedAt: new Date(), version: 2 }),
      confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const handler = new RegisterDocumentsHandler(reservations, workContext);
    const result = await handler.execute(new RegisterDocumentsCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));
    expect(reservations.registerDocuments).toHaveBeenCalledWith('res-1', 'org-1', 1);
    expect(result.documentsCompletedAt).not.toBeNull();
  });

  it('rechaza si la reserva no existe', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(null), list: jest.fn(),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const handler = new RegisterDocumentsHandler(reservations, workContext);
    await expect(
      handler.execute(new RegisterDocumentsCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
