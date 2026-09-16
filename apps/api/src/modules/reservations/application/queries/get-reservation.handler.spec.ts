import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetReservationHandler } from './get-reservation.handler';
import { GetReservationQuery } from './get-reservation.query';
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

describe('GetReservationHandler', () => {
  it('devuelve la reserva cuando la asignacion es valida', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(buildRecord()), list: jest.fn(),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const handler = new GetReservationHandler(reservations, workContext);
    const result = await handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-1', 'branch-1'));
    expect(result.id).toBe('res-1');
  });

  it('rechaza si la reserva no existe en el scope del usuario', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(null), list: jest.fn(),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue({ organizationId: 'org-1', role: 'FRONT_OFFICE' }),
    };
    const handler = new GetReservationHandler(reservations, workContext);
    await expect(
      handler.execute(new GetReservationQuery('res-x', 'uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn(), list: jest.fn(),
      registerPayment: jest.fn(), registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(), findValidAssignment: jest.fn().mockResolvedValue(null),
    };
    const handler = new GetReservationHandler(reservations, workContext);
    await expect(
      handler.execute(new GetReservationQuery('res-1', 'uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
