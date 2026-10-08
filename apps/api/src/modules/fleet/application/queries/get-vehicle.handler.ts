import { Injectable, NotFoundException } from '@nestjs/common';
import { GetVehicleQuery } from './get-vehicle.query';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class GetVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
  ) {}

  async execute(query: GetVehicleQuery): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'READ',
    );

    const vehicle = await this.vehicles.findById(query.vehicleId, {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: `El vehículo con ID ${query.vehicleId} no fue encontrado en esta empresa.`,
      });
    }

    return vehicle;
  }
}
