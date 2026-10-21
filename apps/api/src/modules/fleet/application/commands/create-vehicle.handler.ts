import { Injectable } from '@nestjs/common';
import { CreateVehicleCommand } from './create-vehicle.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { VehiclePassengerCapacityRequiredError, VehiclePlateAlreadyExistsError } from '../../domain/fleet-errors';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class CreateVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'WRITE',
      { targetBranchId: command.assignedBranchId },
    );

    // DEC-FLT-CAP-001: la capacidad de pasajeros se pide siempre al registrar (G-05).
    if (command.passengerCapacity == null) {
      throw new VehiclePassengerCapacityRequiredError();
    }

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
      depositMinimum: command.depositMinimum ?? null,
      passengerCapacity: command.passengerCapacity,
      fuelPrice: command.fuelPrice ?? null,
      photoUrl: command.photoUrl?.trim() || null,
    });
  }
}
