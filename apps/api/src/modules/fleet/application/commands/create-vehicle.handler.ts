import { Injectable } from '@nestjs/common';
import { CreateVehicleCommand } from './create-vehicle.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { isValidPassengerCapacity, VehiclePassengerCapacityRequiredError, VehiclePlateAlreadyExistsError } from '../../domain/fleet-errors';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { FleetVehicle } from '../../domain/vehicle';

@Injectable()
export class CreateVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(command: CreateVehicleCommand): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'WRITE',
      { targetBranchId: command.assignedBranchId },
    );

    // DEC-FLT-CAP-001: la capacidad de pasajeros se pide siempre al registrar (G-05).
    if (!isValidPassengerCapacity(command.passengerCapacity)) {
      throw new VehiclePassengerCapacityRequiredError();
    }

    const sanitizedPlate = command.plate.trim().toUpperCase();

    const existing = await this.vehicles.findByPlate(sanitizedPlate);
    if (existing) {
      throw new VehiclePlateAlreadyExistsError(sanitizedPlate);
    }

    const created = await this.vehicles.create({
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

    // B7 (Respuestas 2026-10-20/21): auditoria de quien/cuando creo el vehiculo.
    await this.audit.recordFleetEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      vehicleId: created.id,
      action: 'VEHICLE_CREATED',
      changes: {
        plate: created.plate,
        brand: created.brand,
        model: created.model,
        operatingCompanyId: context.companyId,
        branchId: created.branchId ?? null,
        status: created.status,
        passengerCapacity: created.passengerCapacity ?? null,
      },
    });
    return created;
  }
}
