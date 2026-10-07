import { Injectable, NotFoundException } from '@nestjs/common';
import { GetVehicleQuery } from './get-vehicle.query';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetRead } from '../policies/fleet-role.policy';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class GetVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: GetVehicleQuery): Promise<FleetVehicle> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    assertFleetRead(context.roleKey);

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
