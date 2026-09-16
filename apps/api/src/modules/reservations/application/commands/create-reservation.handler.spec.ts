import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateReservationHandler } from './create-reservation.handler';
import { CreateReservationCommand } from './create-reservation.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextRepositoryPort } from '../../../users/application/ports/work-context-repository.port';

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

describe('CreateReservationHandler', () => {
  function buildDeps(assignment: { organizationId: string; role: any } | null) {
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn().mockResolvedValue(buildRecord()),
      findById: jest.fn(),
      list: jest.fn(),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    };
    const workContext: jest.Mocked<WorkContextRepositoryPort> = {
      findAssignmentsByFirebaseUid: jest.fn(),
      findValidAssignment: jest.fn().mockResolvedValue(assignment),
    };
    return { reservations, workContext };
  }

  it('crea la reserva en DRAFT con el monto de deposito vigente', async () => {
    const { reservations, workContext } = buildDeps({ organizationId: 'org-1', role: 'FRONT_OFFICE' });
    const handler = new CreateReservationHandler(reservations, workContext);

    const result = await handler.execute(
      new CreateReservationCommand(
        'uid-1',
        'company-1',
        'branch-1',
        'inq-1',
        'cust-1',
        'veh-1',
        'PRESENCIAL',
        new Date('2026-09-20T14:00:00Z'),
        new Date('2026-09-22T14:00:00Z'),
      ),
    );

    expect(reservations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        requiredPaymentAmount: '300.00',
        currency: 'PEN',
        paymentPolicyVersion: 1,
      }),
    );
    expect(result.status).toBe('DRAFT');
  });

  it('rechaza si la fecha de inicio no es anterior a la de fin', async () => {
    const { reservations, workContext } = buildDeps({ organizationId: 'org-1', role: 'FRONT_OFFICE' });
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(
      handler.execute(
        new CreateReservationCommand(
          'uid-1',
          'company-1',
          'branch-1',
          'inq-1',
          'cust-1',
          'veh-1',
          'PRESENCIAL',
          new Date('2026-09-22T14:00:00Z'),
          new Date('2026-09-20T14:00:00Z'),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si la combinacion empresa/sede no es una asignacion vigente', async () => {
    const { reservations, workContext } = buildDeps(null);
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(
      handler.execute(
        new CreateReservationCommand(
          'uid-1',
          'company-ajena',
          'branch-ajena',
          'inq-1',
          'cust-1',
          'veh-1',
          'PRESENCIAL',
          new Date('2026-09-20T14:00:00Z'),
          new Date('2026-09-22T14:00:00Z'),
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
