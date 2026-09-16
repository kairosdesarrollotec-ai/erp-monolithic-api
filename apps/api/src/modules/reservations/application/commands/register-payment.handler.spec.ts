import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RegisterPaymentHandler } from './register-payment.handler';
import { RegisterPaymentCommand } from './register-payment.command';
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

describe('RegisterPaymentHandler', () => {
  function buildDeps(existing: ReservationRecord | null, assignment: any = { organizationId: 'org-1', role: 'FRONT_OFFICE' }) {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn(), findById: jest.fn().mockResolvedValue(existing), list: jest.fn(),
      registerPayment: jest.fn().mockResolvedValue({ ...(existing ?? buildRecord()), paymentValidatedAt: new Date(), version: 2 }),
      registerDocuments: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(), findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    return { reservations, workContext };
  }

  it('marca payment_validated_at sin tocar disponibilidad', async () => {
    const { reservations, workContext } = buildDeps(buildRecord());
    const handler = new RegisterPaymentHandler(reservations, workContext);
    const result = await handler.execute(new RegisterPaymentCommand('res-1', 'uid-1', 'company-1', 'branch-1', 1));
    expect(reservations.registerPayment).toHaveBeenCalledWith('res-1', 'org-1', 1);
    expect(result.paymentValidatedAt).not.toBeNull();
  });

  it('rechaza si la reserva no existe', async () => {
    const { reservations, workContext } = buildDeps(null);
    const handler = new RegisterPaymentHandler(reservations, workContext);
    await expect(
      handler.execute(new RegisterPaymentCommand('res-x', 'uid-1', 'company-1', 'branch-1', 1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si la asignacion no es vigente', async () => {
    const { reservations, workContext } = buildDeps(buildRecord(), null);
    const handler = new RegisterPaymentHandler(reservations, workContext);
    await expect(
      handler.execute(new RegisterPaymentCommand('res-1', 'uid-1', 'company-ajena', 'branch-ajena', 1)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
