import { ListVehicleOperationalRemindersHandler } from './list-vehicle-operational-reminders.handler';
import { BRANCH, COMPANY, buildFleetAccessService } from '../../testing/fleet-test-fixtures';

describe('ListVehicleOperationalRemindersHandler (R5 / C1)', () => {
  it('lists reminders when user has VIEW_VEHICLE_OPERATIONAL_FORMAT', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const reminders = [
      {
        id: 'rem-1',
        vehicleId: 'veh-1',
        vehicle: { plate: 'ABC-123' },
        formatType: 'FORMATO_01_FIVI',
        dueDate: new Date('2026-10-24T00:00:00Z'),
        status: 'PENDING',
        completedRecordId: null,
        completedAt: null,
        createdAt: new Date('2026-10-22T00:00:00Z'),
      },
    ];

    const prisma = {
      vehicleFormatReminder: {
        findMany: jest.fn().mockResolvedValue(reminders),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;

    const handler = new ListVehicleOperationalRemindersHandler(access, prisma);
    const result = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      status: 'PENDING',
    });

    expect(result.total).toBe(1);
    expect(result.items[0].plate).toBe('ABC-123');
    expect(result.items[0].formatType).toBe('FORMATO_01_FIVI');
  });

  it('throws ForbiddenException when role lacks VIEW_VEHICLE_OPERATIONAL_FORMAT', async () => {
    const { access } = buildFleetAccessService('forbidden');
    const prisma = {} as any;

    const handler = new ListVehicleOperationalRemindersHandler(access, prisma);
    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
      }),
    ).rejects.toThrow();
  });
});
