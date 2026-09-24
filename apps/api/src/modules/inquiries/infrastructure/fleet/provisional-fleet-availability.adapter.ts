import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  FleetAvailabilityPort,
  VehicleEligibility,
  VehicleEligibilityQuery,
} from '../../application/ports/fleet-availability.port';

/**
 * PROVISIONAL, NO PRODUCTIVO (PROP-005/PROP-007): el modulo real de Flota
 * no existe. Este adaptador solo resuelve lo que SI esta respaldado hoy:
 * el vehiculo existe y pertenece a la MISMA organizacion y empresa de la
 * consulta (hallazgo ALTO de revalidacion PR#7, aislamiento de vehiculo).
 *
 * NO evalua disponibilidad por fechas ni restricciones de ruta/trocha
 * (BR-CON-005 / SC-CON-004) - no hay catalogo de rutas ni calendario de
 * flota del que leerlas; inventarlos violaria CLAUDE.md seccion 4. Por eso
 * `productionReady = false`: QuoteHandler/ConvertToReservationHandler
 * rechazan operar con este adaptador en produccion salvo habilitacion
 * explicita (ver provisional-quoting.guard.ts).
 *
 * Nivel de SEDE: el stub de Vehicle (PR#6) no modela sede - no hay fuente
 * BDD/SDD de Flota que diga si un vehiculo es de una sede o compartido
 * entre las sedes de una empresa (mismo criterio documentado en
 * schema.prisma para Customer/Vehicle). El aislamiento verificable hoy es
 * organizacion + empresa; la sede de la CONSULTA si se exige (scope).
 */
@Injectable()
export class ProvisionalFleetAvailabilityAdapter extends FleetAvailabilityPort {
  readonly productionReady = false;

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
      select: { id: true },
    });
    if (!vehicle) {
      return { eligible: false, reason: 'El vehiculo indicado no existe en esta empresa.' };
    }
    return { eligible: true, vehicleId: vehicle.id };
  }
}
