import { Injectable } from '@nestjs/common';
import { CreateVehicleCommand } from './create-vehicle.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetWrite, assertCrossBranchAllowed } from '../policies/fleet-role.policy';
import { VehiclePlateAlreadyExistsError } from '../../domain/fleet-errors';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class CreateVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<FleetVehicle> {
    const context = await this.workContext.authorize({
      firebaseUid: command.firebaseUid,
      companyId: command.companyId,
      branchId: command.branchId,
    });

    assertFleetWrite(context.roleKey);
    assertCrossBranchAllowed(context.roleKey, context.branchId, command.assignedBranchId);

    const sanitizedPlate = command.plate.trim().toUpperCase();

    const existing = await this.vehicles.findByPlate(sanitizedPlate);
    if (existing) {
      throw new VehiclePlateAlreadyExistsError(sanitizedPlate);
    }

    return this.vehicles.create({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: command.assignedBranchId?.trim() || command.branchId,
      plate: sanitizedPlate,
      brand: command.brand.trim(),
      model: command.model.trim(),
      year: command.year,
      color: command.color?.trim() || null,
      category: command.category?.trim() || 'SEDAN',
      status: command.status ?? 'AVAILABLE',
      dailyRate: command.dailyRate,
      depositMinimum: command.depositMinimum,
      photoUrl: command.photoUrl?.trim() || null,
    });
  }
}
