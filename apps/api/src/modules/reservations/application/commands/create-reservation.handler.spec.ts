import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateReservationHandler } from './create-reservation.handler';
import { CreateReservationCommand } from './create-reservation.command';
import { ReservationRepositoryPort, ReservationRecord } from '../ports/reservation-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';

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
  function buildDeps(options: {
    context?: { organizationId: string } | 'forbidden';
    customerOrg?: string | null;
    vehicleOrg?: string | null;
    inquiryOrg?: string | null;
  } = {}) {
    const { context = { organizationId: 'org-1' }, customerOrg = 'org-1', vehicleOrg = 'org-1', inquiryOrg = 'org-1' } = options;
    const reservations: jest.Mocked<ReservationRepositoryPort> = {
      create: jest.fn().mockResolvedValue(buildRecord()),
      findById: jest.fn(),
      list: jest.fn(),
      findCustomerById: jest.fn().mockResolvedValue(customerOrg ? { id: 'cust-1', organizationId: customerOrg } : null),
      findVehicleById: jest.fn().mockResolvedValue(vehicleOrg ? { id: 'veh-1', organizationId: vehicleOrg } : null),
      findInquiryById: jest.fn().mockResolvedValue(inquiryOrg ? { id: 'inq-1', organizationId: inquiryOrg } : null),
      registerPayment: jest.fn(),
      registerDocuments: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    };
    const workContext = {
      authorize:
        context === 'forbidden'
          ? jest.fn().mockRejectedValue(new ForbiddenException())
          : jest.fn().mockResolvedValue({ organizationId: context.organizationId, companyId: 'company-1', branchId: 'branch-1', role: 'FRONT_OFFICE' }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    return { reservations, workContext };
  }

  function command(overrides: Partial<{ startAt: Date; endAt: Date; companyId: string; branchId: string }> = {}) {
    return new CreateReservationCommand(
      'uid-1',
      overrides.companyId ?? 'company-1',
      overrides.branchId ?? 'branch-1',
      'inq-1',
      'cust-1',
      'veh-1',
      'PRESENCIAL',
      overrides.startAt ?? new Date('2026-09-20T14:00:00Z'),
      overrides.endAt ?? new Date('2026-09-22T14:00:00Z'),
    );
  }

  it('crea la reserva en DRAFT con el monto de deposito vigente', async () => {
    const { reservations, workContext } = buildDeps();
    const handler = new CreateReservationHandler(reservations, workContext);

    const result = await handler.execute(command());

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
    const { reservations, workContext } = buildDeps();
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(
      handler.execute(command({ startAt: new Date('2026-09-22T14:00:00Z'), endAt: new Date('2026-09-20T14:00:00Z') })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si la combinacion empresa/sede no es una asignacion vigente', async () => {
    const { reservations, workContext } = buildDeps({ context: 'forbidden' });
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(
      handler.execute(command({ companyId: 'company-ajena', branchId: 'branch-ajena' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si el cliente no existe en la organizacion autorizada (referencia cross-tenant)', async () => {
    const { reservations, workContext } = buildDeps({ customerOrg: 'org-ajena' });
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    expect(reservations.create).not.toHaveBeenCalled();
  });

  it('rechaza si el vehiculo no existe en la organizacion autorizada (referencia cross-tenant)', async () => {
    const { reservations, workContext } = buildDeps({ vehicleOrg: null });
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    expect(reservations.create).not.toHaveBeenCalled();
  });

  it('rechaza si la consulta de origen no existe en la organizacion autorizada (referencia cross-tenant)', async () => {
    const { reservations, workContext } = buildDeps({ inquiryOrg: 'org-ajena' });
    const handler = new CreateReservationHandler(reservations, workContext);

    await expect(handler.execute(command())).rejects.toBeInstanceOf(NotFoundException);
    expect(reservations.create).not.toHaveBeenCalled();
  });
});
