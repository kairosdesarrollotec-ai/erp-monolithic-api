import { PrismaReservationRepository } from './prisma-reservation.repository';
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
    expect(err.detail).toContain('22/10/2026 al 28/10/2026');
    expect(tx.vehicleCommitment.create).not.toHaveBeenCalled();
  });
});
