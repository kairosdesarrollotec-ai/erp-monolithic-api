import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  FleetAvailabilityPort,
  VehicleEligibility,
  VehicleEligibilityQuery,
} from '../../application/ports/fleet-availability.port';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Adaptador real de disponibilidad de flota.
 *
 * Aislamiento: verifica que el vehículo pertenezca a la misma
 * organización + empresa de la consulta (FK compuesta en schema.prisma).
 * Si el vehículo tiene branchId asignado, debe coincidir con el de la
 * consulta; si es null el vehículo se considera compartido entre sedes.
 *
 * Disponibilidad: consulta vehicle_commitments buscando cualquier
 * compromiso ACTIVE que se solape con [now, now + estimatedDays * 24h).
 * Solapamiento: startsAt < requestedEndsAt AND endsAt > now.
 *
 * El campo `destination` del query no se evalúa aquí — el catálogo de
 * rutas/trocha no está modelado (PROP-005). productionReady = true porque
 * la elegibilidad por fechas y aislamiento sí está cubierta.
 */
@Injectable()
export class PrismaFleetAvailabilityAdapter extends FleetAvailabilityPort {
  readonly productionReady = true;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async checkEligibility(query: VehicleEligibilityQuery): Promise<VehicleEligibility> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: query.vehicleId,
        organizationId: query.organizationId,
        operatingCompanyId: query.operatingCompanyId,
      },
      select: { id: true, branchId: true },
    });

    if (!vehicle) {
      return { eligible: false, reason: 'El vehículo indicado no existe en esta empresa.' };
    }

    if (vehicle.branchId !== null && vehicle.branchId !== query.branchId) {
      return {
        eligible: false,
        reason: 'El vehículo no está asignado a la sede de esta consulta.',
      };
    }

    const now = new Date();
    const requestedEndsAt = new Date(now.getTime() + query.estimatedDays * MS_PER_DAY);

    const conflict = await this.prisma.vehicleCommitment.findFirst({
      where: {
        vehicleId: query.vehicleId,
        status: 'ACTIVE',
        startsAt: { lt: requestedEndsAt },
        endsAt: { gt: now },
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        eligible: false,
        reason: 'El vehículo no está disponible para el período solicitado.',
      };
    }

    return { eligible: true, vehicleId: vehicle.id };
  }
}
