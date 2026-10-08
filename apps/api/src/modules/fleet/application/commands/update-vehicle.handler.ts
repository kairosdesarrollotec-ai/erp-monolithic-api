import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateVehicleCommand } from './update-vehicle.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { FleetVehicle } from '../../domain/vehicle';

/**
 * Edita los datos descriptivos de un vehiculo (marca, modelo, anio, color,
 * categoria, tarifa diaria, foto y sede asignada).
 *
 * La placa NO es editable aqui: es el identificador natural del vehiculo
 * (unique en el esquema, usada para busqueda/deduplicacion en
 * CreateVehicleHandler) y cambiarla equivaldria a re-matricular el
 * vehiculo. El estado (`status`) tampoco se edita aqui: sigue siendo
 * responsabilidad exclusiva de UpdateVehicleStatusHandler.
 */
@Injectable()
export class UpdateVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
  ) {}

  async execute(command: UpdateVehicleCommand): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'WRITE',
      { targetBranchId: command.assignedBranchId },
    );

    const scope = {
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
    };

    const existing = await this.vehicles.findById(command.vehicleId, scope);

    if (!existing) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        detail: `El vehículo con ID ${command.vehicleId} no fue encontrado en esta empresa.`,
      });
    }

    return this.vehicles.update(command.vehicleId, scope, {
      branchId: command.assignedBranchId?.trim() || existing.branchId,
      brand: command.brand != null ? command.brand.trim() : existing.brand,
      model: command.model != null ? command.model.trim() : existing.model,
      year: command.year,
      color: command.color?.trim() || null,
      category: command.category?.trim() || existing.category,
      dailyRate: command.dailyRate,
      depositMinimum: command.depositMinimum,
      photoUrl: command.photoUrl?.trim() || null,
    });
  }
}
