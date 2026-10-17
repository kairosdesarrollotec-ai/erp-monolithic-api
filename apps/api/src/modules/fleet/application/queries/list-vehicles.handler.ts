import { BadRequestException, Injectable } from '@nestjs/common';
import { parseBusinessInstant } from '../../../../common/time/lima-time';
import { ListVehiclesQuery } from './list-vehicles.query';
import { FleetVehicleRepositoryPort } from '../ports/fleet-vehicle-repository.port';
import { FleetAccessService } from '../services/fleet-access.service';
import { FleetVehicleWithAvailability } from '../../domain/vehicle';

/**
 * availableFrom/availableTo: ambos o ninguno, ISO 8601 (date o date-time),
 * from < to. Una fecha sin hora (YYYY-MM-DD) se interpreta como 00:00 America/Lima (DEC-TZ-LIMA-001); el fin es
 * exclusivo ([from, to)).
 */
export function parseAvailabilityWindow(
  availableFrom?: string,
  availableTo?: string,
): { from: Date; to: Date } | null {
  if (availableFrom === undefined && availableTo === undefined) return null;
  if (availableFrom === undefined || availableTo === undefined) {
    throw new BadRequestException({
      code: 'INVALID_AVAILABILITY_WINDOW',
      detail: 'Debes enviar availableFrom y availableTo juntos para consultar disponibilidad por fechas.',
    });
  }
  const from = parseBusinessInstant(availableFrom);
  const to = parseBusinessInstant(availableTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException({
      code: 'INVALID_AVAILABILITY_WINDOW',
      detail: 'availableFrom y availableTo deben ser fechas ISO 8601 válidas.',
    });
  }
  if (from.getTime() >= to.getTime()) {
    throw new BadRequestException({
      code: 'INVALID_AVAILABILITY_WINDOW',
      detail: 'availableFrom debe ser anterior a availableTo.',
    });
  }
  return { from, to };
}

@Injectable()
export class ListVehiclesHandler {
  constructor(
    private readonly vehicles: FleetVehicleRepositoryPort,
    private readonly access: FleetAccessService,
  ) {}

  async execute(query: ListVehiclesQuery): Promise<{ items: FleetVehicleWithAvailability[]; total: number }> {
    const window = parseAvailabilityWindow(query.availableFrom, query.availableTo);

    const { context } = await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: query.companyId, branchId: query.branchId },
      'READ',
      { targetBranchId: query.filterBranchId },
    );

    const result = await this.vehicles.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      branchId: query.filterBranchId,
      status: query.status,
      search: query.search?.trim(),
      limit: Math.min(Math.max(query.limit, 1), 100),
      offset: Math.max(query.offset, 0),
    });

    if (!window) return result;

    // Una query por fuente para toda la pagina (sin N+1).
    const conflicts = await this.vehicles.findConflicts(
      result.items.map((v) => v.id),
      window.from,
      window.to,
    );
    return {
      total: result.total,
      items: result.items.map((v) => {
        const c = conflicts.get(v.id);
        return {
          ...v,
          availability: c
            ? { available: false, conflictFrom: c.from, conflictTo: c.to, conflictSource: c.source }
            : { available: true },
        };
      }),
    };
  }
}
