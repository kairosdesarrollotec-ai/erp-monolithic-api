import { NotFoundException } from '@nestjs/common';
import { UpdateVehicleStatusHandler } from './update-vehicle-status.handler';
import { UpdateVehicleStatusCommand } from './update-vehicle-status.command';
import { VehicleHasActiveCommitmentError } from '../../domain/fleet-errors';
import {
  BRANCH,
  COMPANY,
  ORG,
  buildFleetVehicle,
  buildFleetVehicleRepository,
  buildFleetAccessService,
} from '../../testing/fleet-test-fixtures';

describe('UpdateVehicleStatusHandler', () => {
  let prisma: any;
  let clock: any;

  beforeEach(() => {
    prisma = {
      rental: { findFirst: jest.fn().mockResolvedValue(null) },
      reservation: { findFirst: jest.fn().mockResolvedValue(null) },
      vehicleCommitment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    clock = {
      now: jest.fn().mockReturnValue(new Date('2026-10-27T10:00:00Z')),
    };
  });

  it('actualiza el estado de un vehículo existente', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access, workContext } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'MAINTENANCE',
    );

    const result = await handler.execute(command);

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-1',
      companyId: COMPANY,
      branchId: BRANCH,
    });
    expect(repository.findById).toHaveBeenCalledWith('veh-1', {
      organizationId: ORG,
      operatingCompanyId: COMPANY,
    });
    expect(repository.updateStatus).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: ORG, operatingCompanyId: COMPANY },
      'MAINTENANCE',
    );
    expect(result.status).toBe('MAINTENANCE');
  });

  it('lanza NotFoundException si el vehículo no existe en la empresa', async () => {
    const repository = buildFleetVehicleRepository(null);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'inexistente',
      COMPANY,
      BRANCH,
      'RENTED',
    );

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('HU-15: bloquea pasar a OUT_OF_SERVICE si tiene alquiler activo (422 VEHICLE_HAS_ACTIVE_COMMITMENT)', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    prisma.rental.findFirst.mockResolvedValue({ id: 'rent-active', status: 'ACTIVE' });
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'OUT_OF_SERVICE',
    );

    await expect(handler.execute(command)).rejects.toThrow(VehicleHasActiveCommitmentError);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('HU-15: bloquea pasar a OUT_OF_SERVICE si tiene reserva confirmada activa o futura', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    prisma.reservation.findFirst.mockResolvedValue({ id: 'res-future', status: 'CONFIRMED' });
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'OUT_OF_SERVICE',
    );

    await expect(handler.execute(command)).rejects.toThrow(VehicleHasActiveCommitmentError);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('HU-15: permite pasar a OUT_OF_SERVICE si no tiene compromisos activos', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'OUT_OF_SERVICE',
    );

    const result = await handler.execute(command);
    expect(result.status).toBe('OUT_OF_SERVICE');
  });

  it('HU-15: cambio a MAINTENANCE no se bloquea por el guard de compromisos (solo aplica a OUT_OF_SERVICE)', async () => {
    const vehicle = buildFleetVehicle({ status: 'AVAILABLE' });
    const repository = buildFleetVehicleRepository(vehicle);
    const { access } = buildFleetAccessService('CAMPO');
    prisma.rental.findFirst.mockResolvedValue({ id: 'rent-active', status: 'ACTIVE' });
    const handler = new UpdateVehicleStatusHandler(repository, access, prisma, clock);

    const command = new UpdateVehicleStatusCommand(
      'uid-1',
      'veh-1',
      COMPANY,
      BRANCH,
      'MAINTENANCE',
    );

    const result = await handler.execute(command);
    expect(result.status).toBe('MAINTENANCE');
    expect(repository.updateStatus).toHaveBeenCalledWith('veh-1', expect.anything(), 'MAINTENANCE');
  });
});
