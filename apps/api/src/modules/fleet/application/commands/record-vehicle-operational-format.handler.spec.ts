import { RecordVehicleOperationalFormatHandler } from './record-vehicle-operational-format.handler';
import { RecordVehicleOperationalFormatCommand } from './record-vehicle-operational-format.command';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BRANCH, COMPANY, ORG, buildFleetAccessService } from '../../testing/fleet-test-fixtures';

describe('RecordVehicleOperationalFormatHandler (R5)', () => {
  const clock = { now: () => new Date('2026-10-23T10:00:00Z') };

  it('rejects invalid format type', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const prisma = {} as any;
    const handler = new RecordVehicleOperationalFormatHandler(access, prisma, clock);

    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        vehicleId: 'veh-1',
        formatType: 'FORMATO_INVALIDO' as any,
        performedBy: 'Juan Mecánico',
        data: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if vehicle does not exist in company', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const handler = new RecordVehicleOperationalFormatHandler(access, prisma, clock);

    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        vehicleId: 'veh-not-found',
        formatType: 'FORMATO_01_FIVI',
        performedBy: 'Juan Mecánico',
        data: { fiv_puertas: 'B' },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('records operational format and completes pending reminders for the vehicle', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const createdRecord = {
      id: 'rec-123',
      vehicleId: 'veh-1',
      formatType: 'FORMATO_01_FIVI',
      processType: 'FLEET_ROUTINE',
      processId: null,
      odometerKm: 35000,
      fuelLevelLines: 8,
      data: { fiv_carroceria: 'B', fcke_extintor: 'B' },
      observations: 'Todo operativo',
      performedBy: 'Juan Mecánico',
      performedAt: new Date('2026-10-23T10:00:00Z'),
      createdAt: new Date('2026-10-23T10:00:00Z'),
    };

    const txMock = {
      vehicleOperationalRecord: {
        create: jest.fn().mockResolvedValue(createdRecord),
      },
      vehicleFormatReminder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'veh-1', plate: 'ABC-123' }),
      },
      $transaction: jest.fn((callback) => callback(txMock)),
    } as any;

    const handler = new RecordVehicleOperationalFormatHandler(access, prisma, clock);

    const result = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      vehicleId: 'veh-1',
      formatType: 'FORMATO_01_FIVI',
      processType: 'FLEET_ROUTINE',
      odometerKm: 35000,
      fuelLevelLines: 8,
      data: { fiv_carroceria: 'B', fcke_extintor: 'B' },
      observations: 'Todo operativo',
      performedBy: 'Juan Mecánico',
    });

    expect(result.id).toBe('rec-123');
    expect(result.formatType).toBe('FORMATO_01_FIVI');
    expect(txMock.vehicleFormatReminder.updateMany).toHaveBeenCalledWith({
      where: {
        vehicleId: 'veh-1',
        formatType: 'FORMATO_01_FIVI',
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: {
        status: 'COMPLETED',
        completedRecordId: 'rec-123',
        completedAt: clock.now(),
      },
    });
  });

  it('throws ForbiddenException when role does not have REGISTER_VEHICLE_OPERATIONAL_FORMAT', async () => {
    const { access } = buildFleetAccessService('AUDITORIA');
    const prisma = {} as any;
    const handler = new RecordVehicleOperationalFormatHandler(access, prisma, clock);

    await expect(
      handler.execute({
        firebaseUid: 'uid-1',
        companyId: COMPANY,
        branchId: BRANCH,
        vehicleId: 'veh-1',
        formatType: 'FORMATO_01_FIVI',
        performedBy: 'Auditor',
        data: {},
      }),
    ).rejects.toThrow();
  });

  it('records FORMATO_02_FIV, FORMATO_08_FCKE and FORMATO_06_RNC linked to rental delivery or return (C2)', async () => {
    const { access } = buildFleetAccessService('CAMPO');
    const txMock = {
      vehicleOperationalRecord: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `rec-${data.formatType}`, ...data, createdAt: new Date() })),
      },
      vehicleFormatReminder: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'veh-1', plate: 'ABC-123' }),
      },
      $transaction: jest.fn((callback) => callback(txMock)),
    } as any;

    const handler = new RecordVehicleOperationalFormatHandler(access, prisma, clock);

    // FIV en entrega
    const fiv = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      vehicleId: 'veh-1',
      formatType: 'FORMATO_02_FIV',
      processType: 'RENTAL',
      processId: 'rent-100',
      odometerKm: 45000,
      fuelLevelLines: 16,
      data: { fiv_puertas_capo_cajuela: 'B' },
      performedBy: 'Carlos Operador',
    });
    expect(fiv.formatType).toBe('FORMATO_02_FIV');
    expect(fiv.processType).toBe('RENTAL');
    expect(fiv.processId).toBe('rent-100');

    // FCKE en devolucion
    const fcke = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      vehicleId: 'veh-1',
      formatType: 'FORMATO_08_FCKE',
      processType: 'RETURN',
      processId: 'ret-200',
      data: { fcke_extintor: 'B', fcke_gata_botella: 'B' },
      performedBy: 'Carlos Operador',
    });
    expect(fcke.formatType).toBe('FORMATO_08_FCKE');
    expect(fcke.processType).toBe('RETURN');
    expect(fcke.processId).toBe('ret-200');

    // RNC en entrega
    const rnc = await handler.execute({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
      vehicleId: 'veh-1',
      formatType: 'FORMATO_06_RNC',
      processType: 'RENTAL',
      processId: 'rent-100',
      odometerKm: 45000,
      fuelLevelLines: 16,
      data: { sugerencia: 'Tanque lleno verificado' },
      performedBy: 'Carlos Operador',
    });
    expect(rnc.formatType).toBe('FORMATO_06_RNC');
    expect(rnc.fuelLevelLines).toBe(16);
  });
});
