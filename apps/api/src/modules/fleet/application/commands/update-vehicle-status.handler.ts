import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateVehicleStatusCommand } from './update-vehicle-status.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetWrite } from '../policies/fleet-role.policy';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class UpdateVehicleStatusHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: UpdateVehicleStatusCommand): Promise<FleetVehicle> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    assertFleetWrite(context.roleKey);

    const vehicle = await this.vehicles.findById(command.vehicleId, {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: `El vehículo con ID ${command.vehicleId} no fue encontrado en esta empresa.`,
      });
    }

    return this.vehicles.updateStatus(
      command.vehicleId,
      {
        organizationId: context.organizationId,
        operatingCompanyId: context.companyId,
      },
      command.status,
    );
  }
}
