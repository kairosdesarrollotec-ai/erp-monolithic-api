import { VehicleFormatReminderScheduler } from './vehicle-format-reminder.scheduler';

describe('VehicleFormatReminderScheduler (R5)', () => {
  const clock = { now: () => new Date('2026-10-23T12:00:00Z') };

  it('marks overdue reminders and notifies Gerencia', async () => {
    const overdueReminder = {
      id: 'rem-overdue',
      vehicleId: 'veh-1',
      formatType: 'FORMATO_01_FIVI',
      dueDate: new Date('2026-10-22T10:00:00Z'),
    };

    const prisma = {
      vehicleFormatReminder: {
        findMany: jest.fn().mockResolvedValue([overdueReminder]),
        update: jest.fn().mockResolvedValue({ id: 'rem-overdue', status: 'OVERDUE' }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rem-new' }),
      },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicleOperationalRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const outbox = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const scheduler = new VehicleFormatReminderScheduler(prisma, clock, outbox);
    const summary = await scheduler.run('company-1', 'org-1');

    expect(summary.markedOverdue).toBe(1);
    expect(prisma.vehicleFormatReminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-overdue' },
      data: { status: 'OVERDUE', updatedAt: clock.now() },
    });
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RecordatorioFormatoVencido.v1',
        aggregateId: 'veh-1',
      }),
    );
  });

  it('generates reminders for vehicles without recent inspection and avoids duplicating open reminders', async () => {
    const activeVehicle = {
      id: 'veh-active',
      branchId: 'branch-1',
      status: 'AVAILABLE',
      createdAt: new Date('2026-09-01T00:00:00Z'),
    };

    const prisma = {
      vehicleFormatReminder: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null), // no open reminders
        create: jest.fn().mockResolvedValue({ id: 'rem-created' }),
      },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([activeVehicle]),
      },
      vehicleOperationalRecord: {
        findFirst: jest.fn().mockResolvedValue(null), // no inspections
      },
    } as any;

    const outbox = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const scheduler = new VehicleFormatReminderScheduler(prisma, clock, outbox);
    const summary = await scheduler.run('company-1', 'org-1');

    // Generates 2 reminders: 1 for FIVI, 1 for FITVM
    expect(summary.created).toBe(2);
    expect(prisma.vehicleFormatReminder.create).toHaveBeenCalledTimes(2);
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RecordatorioFiviGenerado.v1',
        aggregateId: 'veh-active',
      }),
    );
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RecordatorioFitvmGenerado.v1',
        aggregateId: 'veh-active',
      }),
    );
  });

  it('does NOT duplicate reminder if an open reminder already exists', async () => {
    const activeVehicle = {
      id: 'veh-active',
      branchId: 'branch-1',
      status: 'AVAILABLE',
      createdAt: new Date('2026-10-15T00:00:00Z'),
    };

    const prisma = {
      vehicleFormatReminder: {
        findMany: jest.fn().mockResolvedValue([]),
        // Returns existing open reminder for both checks:
        findFirst: jest.fn().mockResolvedValue({ id: 'rem-existing', status: 'PENDING' }),
        create: jest.fn(),
      },
      vehicle: {
        findMany: jest.fn().mockResolvedValue([activeVehicle]),
      },
      vehicleOperationalRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const outbox = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const scheduler = new VehicleFormatReminderScheduler(prisma, clock, outbox);
    const summary = await scheduler.run('company-1', 'org-1');

    expect(summary.created).toBe(0);
    expect(prisma.vehicleFormatReminder.create).not.toHaveBeenCalled();
  });
});
