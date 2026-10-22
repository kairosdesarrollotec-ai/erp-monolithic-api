import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateVehicleCommand } from './update-vehicle.command';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { FleetVehicle } from '../../domain/vehicle';
import { isValidPassengerCapacity, VehiclePassengerCapacityRequiredError } from '../../domain/fleet-errors';

/**
 * Edita los datos descriptivos de un vehiculo (marca, modelo, anio, color,
 * categoria, tarifa diaria, foto y sede asignada).
 *
 * La placa NO es editable aqui: es el identificador natural del vehiculo
 * (unique en el esquema, usada para busqueda/deduplicacion en
 * CreateVehicleHandler) y cambiarla equivaldria a re-matricular el
 * vehiculo. El estado (`status`) tampoco se edita aqui: sigue siendo
 * responsabilidad exclusiva de UpdateVehicleStatusHandler.
 *
 * DEC-FLT-CAP-001: `passengerCapacity` omitido no cambia el valor (un vehiculo anterior con capacidad NULL
 * sigue editable); enviado como `null`, 0 o negativo (fuera de 1..60) se rechaza con 400 PASSENGER_CAPACITY_REQUIRED.
 */
@Injectable()
export class UpdateVehicleHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(command: UpdateVehicleCommand): Promise<FleetVehicle> {
    const { context } = await this.access.authorize(
      { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
      'WRITE',
      { targetBranchId: command.assignedBranchId },
    );

    if (command.passengerCapacity !== undefined && !isValidPassengerCapacity(command.passengerCapacity)) {
      throw new VehiclePassengerCapacityRequiredError();
    }

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

    // DEC-ALQ-THIRDPATH-001: solo Gerencia (accion FLEET.MANAGE_THIRD_PATH de la matriz ADM-02) cambia la marca.
    const thirdPathChanges =
      command.thirdPathEligible !== undefined && command.thirdPathEligible !== (existing.thirdPathEligible ?? false);
    if (thirdPathChanges) {
      await this.access.authorize(
        { firebaseUid: command.firebaseUid, companyId: command.companyId, branchId: command.branchId },
        'MANAGE_THIRD_PATH',
      );
    }

    const updated = await this.vehicles.update(command.vehicleId, scope, {
      branchId: command.assignedBranchId?.trim() || existing.branchId,
      brand: command.brand != null ? command.brand.trim() : existing.brand,
      model: command.model != null ? command.model.trim() : existing.model,
      year: command.year,
      color: command.color?.trim() || null,
      category: command.category?.trim() || existing.category,
      dailyRate: command.dailyRate,
      depositMinimum: command.depositMinimum,
      passengerCapacity: command.passengerCapacity,
      fuelPrice: command.fuelPrice,
      photoUrl: command.photoUrl?.trim() || null,
      thirdPathEligible: thirdPathChanges ? command.thirdPathEligible : undefined,
    });

    // B7: auditoria de quien/cuando edito el vehiculo, con el diff antes/despues de los campos que cambiaron.
    const tracked = [
      'branchId', 'brand', 'model', 'year', 'color', 'category',
      'dailyRate', 'depositMinimum', 'passengerCapacity', 'fuelPrice', 'photoUrl', 'thirdPathEligible',
    ] as const;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of tracked) {
      const before = existing[key] ?? null;
      const after = updated[key] ?? null;
      if (before !== after) changes[key] = { from: before, to: after };
    }
    await this.audit.recordFleetEvent({
      organizationId: context.organizationId,
      actorUserId: command.firebaseUid,
      vehicleId: command.vehicleId,
      action: 'VEHICLE_UPDATED',
      changes,
    });
    return updated;
  }
}
