import { Injectable } from '@nestjs/common';
import { FleetVehicleRepositoryPort } from '../../../fleet/application/ports/fleet-vehicle-repository.port';
import {
  FleetAvailabilityPort,
  VehicleEligibility,
  VehicleEligibilityQuery,
} from '../../application/ports/fleet-availability.port';

/**
 * Adaptador REAL de `FleetAvailabilityPort` que consulta el modulo Fleet
 * (in-process, mismo monolito - sin HTTP interno) via
 * `FleetVehicleRepositoryPort`.
 *
 * Reemplaza a `ProvisionalFleetAvailabilityAdapter` (PROP-005/PROP-007):
 * ahora que el modulo Fleet existe, la elegibilidad verifica:
 * 1. Aislamiento organizacion + empresa (igual que el provisional, ahora
 *    respaldado por `FleetVehicleRepositoryPort.findById` con scope).
 * 2. Estado del vehiculo: solo `AVAILABLE` es elegible (RENTED,
 *    MAINTENANCE y OUT_OF_SERVICE no lo son).
 *
 * NO evalua disponibilidad por fechas/calendario ni restricciones de
 * ruta/trocha (BR-CON-005 / SC-CON-004): el modulo Fleet no modela
 * calendario de reservas ni catalogo de rutas; inventarlos violaria
 * CLAUDE.md seccion 4. Por eso `productionReady` refleja solo lo que este
 * adaptador SI puede garantizar hoy (existencia + estado), no el alcance
 * completo del contrato documentado en el puerto.
 *
 * Nivel de SEDE: `FleetVehicle.branchId` es opcional (un vehiculo puede
 * ser compartido entre sedes de una empresa); por eso no se filtra por
 * `query.branchId` aqui, igual que hacia el adaptador provisional.
 */
@Injectable()
export class FleetModuleAvailabilityAdapter extends FleetAvailabilityPort {
  readonly productionReady = true;

  constructor(private readonly fleetVehicles: FleetVehicleRepositoryPort) {
    super();
  }

  async checkEligibility(query: VehicleEligibilityQuery): Promise<VehicleEligibility> {
    const vehicle = await this.fleetVehicles.findById(query.vehicleId, {
      organizationId: query.organizationId,
      operatingCompanyId: query.operatingCompanyId,
    });
    if (!vehicle) {
      return { eligible: false, reason: 'El vehiculo indicado no existe en esta empresa.' };
    }
    if (vehicle.status !== 'AVAILABLE') {
      return { eligible: false, reason: 'El vehiculo indicado no esta disponible actualmente.' };
    }
    return { eligible: true, vehicleId: vehicle.id };
  }
}
