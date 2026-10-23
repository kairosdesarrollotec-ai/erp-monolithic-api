import { PrismaReservationRepository, isVehicleCommitmentExclusionViolation } from './prisma-reservation.repository';
import { VehicleNotAvailableError } from '../../domain/reservation-errors';

const START = new Date('2026-10-20T00:00:00.000Z');
const END = new Date('2026-10-25T00:00:00.000Z');

function buildPrisma(commitments: unknown[] = [], reservations: unknown[] = []) {
  return {
    vehicleCommitment: { findMany: jest.fn().mockResolvedValue(commitments) },
    reservation: { findMany: jest.fn().mockResolvedValue(reservations) },
  };
}

describe('PrismaReservationRepository.isVehicleAvailable', () => {
  it('no está disponible si hay un vehicle_commitment solapado (alquiler / reserva confirmada)', async () => {
    const prisma = buildPrisma([{ vehicleId: 'v1', startsAt: START, endsAt: END }]);
    const repo = new PrismaReservationRepository(prisma as never);

    expect(await repo.isVehicleAvailable('v1', START, END)).toBe(false);
    expect(prisma.vehicleCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['ACTIVE', 'CONSOLIDATED'] } }) }),
    );
  });

  it('no está disponible si hay una reserva no terminal solapada', async () => {
    const prisma = buildPrisma([], [{ vehicleId: 'v1', startAt: START, endAt: END }]);
    const repo = new PrismaReservationRepository(prisma as never);

    expect(await repo.isVehicleAvailable('v1', START, END)).toBe(false);
  });

  it('está disponible si ninguna fuente tiene solape', async () => {
    const repo = new PrismaReservationRepository(buildPrisma() as never);

    expect(await repo.isVehicleAvailable('v1', START, END)).toBe(true);
  });
});

describe('PrismaReservationRepository.confirm - VEHICLE_NOT_AVAILABLE', () => {
  it('lanza VehicleNotAvailableError (409) con las fechas ocupadas en español', async () => {
    const reservation = {
      id: 'res-1',
      vehicleId: 'v1',
      startAt: START,
      endAt: END,
      version: 1,
      paymentValidatedAt: new Date(),
      documentsCompletedAt: new Date(),
    };
    const tx = {
      reservation: { findFirst: jest.fn().mockResolvedValue(reservation), findMany: jest.fn().mockResolvedValue([]) },
      vehicleCommitment: {
        findMany: jest.fn().mockResolvedValue([
          { vehicleId: 'v1', startsAt: new Date('2026-10-22T00:00:00Z'), endsAt: new Date('2026-10-28T00:00:00Z') },
        ]),
        create: jest.fn(),
      },
    };
    const repo = new PrismaReservationRepository({} as never);
    const scope = { organizationId: 'o', operatingCompanyId: 'c', branchId: 'b' };

    const error = await repo.confirm('res-1', scope, 1, tx as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VehicleNotAvailableError);
    const err = error as VehicleNotAvailableError;
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('VEHICLE_NOT_AVAILABLE');
    expect(err.detail).toContain('21/10/2026 al 27/10/2026') // 00:00Z = 19:00 del dia previo en Lima (DEC-TZ-LIMA-001);
    expect(tx.vehicleCommitment.create).not.toHaveBeenCalled();
  });
});

describe('PrismaReservationRepository.confirm - exclusion de rango en BD (PEND-07)', () => {
  const scope = { organizationId: 'o', operatingCompanyId: 'c', branchId: 'b' };
  const reservation = {
    id: 'res-1', vehicleId: 'v1', startAt: START, endAt: END, version: 1,
    paymentValidatedAt: new Date(), documentsCompletedAt: new Date(),
  };

  it('si el INSERT del commitment viola la exclusion (23P01, carrera perdida) -> 409 VEHICLE_NOT_AVAILABLE, no un 500', async () => {
    const dbError = Object.assign(new Error('conflicting key value violates exclusion constraint "vehicle_commitments_no_overlap_excl"'), { code: 'P2010', meta: { code: '23P01' } });
    const tx = {
      reservation: { findFirst: jest.fn().mockResolvedValue(reservation), findMany: jest.fn().mockResolvedValue([]) },
      vehicleCommitment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockRejectedValue(dbError) },
    };
    const repo = new PrismaReservationRepository({} as never);

    const error = await repo.confirm('res-1', scope, 1, tx as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(VehicleNotAvailableError);
    expect((error as VehicleNotAvailableError).httpStatus).toBe(409);
  });

  it('otros errores del INSERT se propagan sin traducir', async () => {
    const boom = new Error('connection reset');
    const tx = {
      reservation: { findFirst: jest.fn().mockResolvedValue(reservation), findMany: jest.fn().mockResolvedValue([]) },
      vehicleCommitment: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockRejectedValue(boom) },
    };
    const repo = new PrismaReservationRepository({} as never);

    await expect(repo.confirm('res-1', scope, 1, tx as never)).rejects.toBe(boom);
  });

  it('isVehicleCommitmentExclusionViolation reconoce 23P01 por meta.code, code o nombre de la constraint', () => {
    expect(isVehicleCommitmentExclusionViolation({ meta: { code: '23P01' } })).toBe(true);
    expect(isVehicleCommitmentExclusionViolation({ code: '23P01' })).toBe(true);
    expect(isVehicleCommitmentExclusionViolation(new Error('violates exclusion constraint "vehicle_commitments_no_overlap_excl"'))).toBe(true);
    expect(isVehicleCommitmentExclusionViolation(new Error('unique constraint failed'))).toBe(false);
    expect(isVehicleCommitmentExclusionViolation(null)).toBe(false);
  });
});

describe('PrismaReservationRepository.create', () => {
  it('persiste canComeToOffice y customerLocation', async () => {
    const createdRow = {
      id: 'res-new',
      organizationId: 'o',
      operatingCompanyId: 'c',
      branchId: 'b',
      inquiryId: 'inq-1',
      customerId: 'cust-1',
      vehicleId: 'v1',
      channelMode: 'PRESENCIAL',
      canComeToOffice: true,
      customerLocation: 'AYACUCHO',
      startAt: START,
      endAt: END,
      requiredPaymentAmount: '300.00',
      currency: 'PEN',
      paymentPolicyVersion: 1,
      paymentValidatedAt: null,
      documentsCompletedAt: null,
      confirmedAt: null,
      paymentMethod: null,
      paymentAmount: null,
      paymentOperationNumber: null,
      payerName: null,
      paymentVoucherDocumentId: null,
      paymentRegisteredBy: null,
      createdAt: new Date(),
      createdBy: 'uid-1',
      version: 1,
      status: 'DRAFT',
      customer: { fullName: 'Juan Perez' },
      vehicle: { brand: 'Toyota', model: 'Hilux', plate: 'ABC-123', passengerCapacity: 5, depositMinimum: null, fuelPrice: null },
    };

    const prisma = {
      reservation: {
        create: jest.fn().mockResolvedValue(createdRow),
      },
    };
    const repo = new PrismaReservationRepository(prisma as never);

    const result = await repo.create({
      organizationId: 'o',
      operatingCompanyId: 'c',
      branchId: 'b',
      inquiryId: 'inq-1',
      customerId: 'cust-1',
      vehicleId: 'v1',
      channelMode: 'PRESENCIAL',
      canComeToOffice: true,
      customerLocation: 'AYACUCHO',
      startAt: START,
      endAt: END,
      requiredPaymentAmount: '300.00',
      currency: 'PEN',
      paymentPolicyVersion: 1,
      createdBy: 'uid-1',
    });

    expect(prisma.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          canComeToOffice: true,
          customerLocation: 'AYACUCHO',
        }),
      }),
    );
    expect(result.canComeToOffice).toBe(true);
    expect(result.customerLocation).toBe('AYACUCHO');
  });
});

