import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { findFirstVehicleConflict, formatDateDMY } from '../../../../common/persistence/vehicle-overlap';
import {
  FleetAvailabilityPort,
  VehicleEligibility,
  VehicleEligibilityQuery,
} from '../../application/ports/fleet-availability.port';
import { calendarDateToLimaStart } from '../../../../common/time/lima-time';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Adaptador real de disponibilidad de flota.
 *
 * Aislamiento: verifica que el vehículo pertenezca a la misma
 * organización + empresa de la consulta (FK compuesta en schema.prisma).
 * Si el vehículo tiene branchId asignado, debe coincidir con el de la
 * consulta; si es null el vehículo se considera compartido entre sedes.
 *
 * Disponibilidad: ventana [startsAt, startsAt + estimatedDays * 24h), con
 * `startsAt` = fecha de viaje de la consulta (o `now` si la consulta no la
 * tiene). Regla compartida de solape (common/persistence/vehicle-overlap.ts):
 * ocupado si hay un vehicle_commitment ACTIVE|CONSOLIDATED o una reserva no
 * terminal con inicio < fin solicitado Y fin > inicio solicitado.
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
      select: {
        id: true,
        branchId: true,
        dailyRate: true,
        status: true,
        suitableForTrocha: true,
        rateNormal: true,
        ratePlus: true,
        rateLibre: true,
      },
    });

    if (!vehicle) {
      return { eligible: false, reason: 'El vehículo indicado no existe en esta empresa.' };
    }

    // Russbel 22-oct-2026: un vehiculo en mantenimiento o fuera de servicio no es cotizable/elegible (422 VEHICLE_NOT_ELIGIBLE).
    // RENTED no se bloquea aqui: la ocupacion futura la decide el solape de compromisos/reservas de la ventana.
    if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'OUT_OF_SERVICE') {
      return {
        eligible: false,
        reason:
          vehicle.status === 'MAINTENANCE'
            ? 'El vehículo está en mantenimiento y no puede cotizarse ni reservarse.'
            : 'El vehículo está fuera de servicio y no puede cotizarse ni reservarse.',
      };
    }

    if (vehicle.branchId !== null && vehicle.branchId !== query.branchId) {
      return {
        eligible: false,
        reason: 'El vehículo no está asignado a la sede de esta consulta.',
      };
    }

    // Correccion (oct 2026): el precio de cotizacion es el dailyRate del
    // vehiculo (administrado en FLO-02), no un tarifario separado por
    // empresa - ver el comentario en fleet-availability.port.ts.
    if (vehicle.dailyRate == null && !vehicle.rateNormal) {
      return {
        eligible: false,
        reason: 'Este vehículo no tiene tarifa configurada en Flota. Configúrala en la ficha del vehículo antes de cotizar.',
      };
    }

    // `startsAt` = Inquiry.travelStartDate (@db.Date, medianoche UTC del dia calendario):
    // la ventana arranca a las 00:00 de ese dia en America/Lima (DEC-TZ-LIMA-001).
    const windowStart = query.startsAt ? calendarDateToLimaStart(query.startsAt) : new Date();
    const windowEnd = new Date(windowStart.getTime() + query.estimatedDays * MS_PER_DAY);

    const conflict = await findFirstVehicleConflict(this.prisma, query.vehicleId, windowStart, windowEnd);

    if (conflict) {
      const origen = conflict.source === 'COMMITMENT' ? 'un alquiler o compromiso' : 'una reserva';
      return {
        eligible: false,
        reason: `El vehículo no está disponible para el período solicitado (${formatDateDMY(windowStart)} al ${formatDateDMY(windowEnd)}): choca con ${origen} del ${formatDateDMY(conflict.from)} al ${formatDateDMY(conflict.to)}.`,
      };
    }

    const dailyRate = vehicle.rateNormal ? vehicle.rateNormal.toString() : (vehicle.dailyRate ? vehicle.dailyRate.toString() : '0');

    return {
      eligible: true,
      vehicleId: vehicle.id,
      dailyRate,
      suitableForTrocha: vehicle.suitableForTrocha ?? false,
      rateNormal: vehicle.rateNormal ? vehicle.rateNormal.toString() : null,
      ratePlus: vehicle.ratePlus ? vehicle.ratePlus.toString() : null,
      rateLibre: vehicle.rateLibre ? vehicle.rateLibre.toString() : null,
    };
  }
}
