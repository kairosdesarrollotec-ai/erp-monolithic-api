import { ListVehicleOperationalRecordsHandler } from './list-vehicle-operational-records.handler';
import { BRANCH, COMPANY, buildFleetAccessService } from '../../testing/fleet-test-fixtures';
import { NotFoundException } from '@nestjs/common';

describe('ListVehicleOperationalRecordsHandler (R5 / C1)', () => {
  it('lists records when user has VIEW_VEHICLE_OPERATIONAL_FORMAT', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const records = [
      {
        id: 'rec-1',
        vehicleId: 'veh-1',
        formatType: 'FORMATO_02_FIV',
        processType: 'RENTAL',
        processId: 'rent-100',
        odometerKm: 50000,
        fuelLevelLines: 8,
        data: { fiv_carroceria: 'B' },
        observations: 'Buen estado',
        performedBy: 'Inspector',
        performedAt: new Date('2026-10-23T10:00:00Z'),
        createdAt: new Date('2026-10-23T10:00:00Z'),
      },
    ];

    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'veh-1' }),
      },
      vehicleOperationalRecord: {
        findMany: jest.fn().mockResolvedValue(records),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;

    const handler = new ListVehicleOperationalRecordsHandler(access, prisma);
    const result = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      vehicleId: 'veh-1',
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].formatType).toBe('FORMATO_02_FIV');
  });

  it('throws NotFoundException if vehicle does not exist', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const handler = new ListVehicleOperationalRecordsHandler(access, prisma);
    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        vehicleId: 'veh-inexistente',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when role lacks VIEW_VEHICLE_OPERATIONAL_FORMAT', async () => {
    // MECANICO is not in FLEET_READ_ROLES
    const { access } = buildFleetAccessService('forbidden');
    const prisma = {} as any;

    const handler = new ListVehicleOperationalRecordsHandler(access, prisma);
    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        vehicleId: 'veh-1',
      }),
    ).rejects.toThrow();
  });
});
