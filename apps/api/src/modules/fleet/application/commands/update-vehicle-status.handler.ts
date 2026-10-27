import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateVehicleStatusCommand } from './update-vehicle-status.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { FleetVehicle } from '../../domain/vehicle';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { VehicleHasActiveCommitmentError } from '../../domain/fleet-errors';

@Injectable()
export class UpdateVehicleStatusHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
    private readonly prisma: PrismaService,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: UpdateVehicleStatusCommand): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'WRITE',
    );

    const vehicle = await this.vehicles.findById(command.vehicleId, {
      organizationId: context.organizationId,
      operatingCompanyId: command.companyId,
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: `El vehículo con ID ${command.vehicleId} no fue encontrado en esta empresa.`,
      });
    }

    if (command.status === 'OUT_OF_SERVICE') {
      const activeRental = await this.prisma.rental.findFirst({
        where: {
          vehicleId: command.vehicleId,
          status: { in: ['ACTIVE', 'RETURN_IN_PROGRESS'] },
        },
      });
      if (activeRental) {
        throw new VehicleHasActiveCommitmentError(
          'No se puede poner fuera de servicio el vehículo: tiene un contrato de alquiler activo.',
        );
      }

      const now = this.clock.now();
      const activeReservation = await this.prisma.reservation.findFirst({
        where: {
          vehicleId: command.vehicleId,
          status: 'CONFIRMED',
          endAt: { gt: now },
        },
      });
      if (activeReservation) {
        throw new VehicleHasActiveCommitmentError(
          'No se puede poner fuera de servicio el vehículo: tiene una reserva confirmada activa o futura.',
        );
      }

      const activeCommitment = await this.prisma.vehicleCommitment.findFirst({
        where: {
          vehicleId: command.vehicleId,
          status: { in: ['ACTIVE', 'CONSOLIDATED'] },
          endsAt: { gt: now },
        },
      });
      if (activeCommitment) {
        throw new VehicleHasActiveCommitmentError(
          'No se puede poner fuera de servicio el vehículo: tiene un compromiso de vehículo activo o futuro.',
        );
      }
    }

    return this.vehicles.updateStatus(
      command.vehicleId,
      {
        organizationId: context.organizationId,
        operatingCompanyId: command.companyId,
      },
      command.status,
    );
  }
}
