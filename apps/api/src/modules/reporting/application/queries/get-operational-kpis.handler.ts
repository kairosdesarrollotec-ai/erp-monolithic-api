import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import type { OperationalKpisResult } from '../../presentation/http/dto/operational-kpis.response';
import { GetOperationalKpisQuery } from './get-operational-kpis.query';
import { validateDateRange } from './reporting.utils';
import { toLimaDateString } from '../../../../common/time/lima-time';

/**
 * REP-01 — KPIs operativos en tiempo real.
 *
 * BR-REP-001: requiere REPORT.READ_OPERATIONAL.
 * BR-REP-004: aislamiento multiempresa — todas las queries filtran por operatingCompanyId.
 * BR-REP-005: rango máximo 90 días (validado en el handler).
 * BR-REP-007: PLATFORM_ADMIN / CORPORATE_AUDITOR pueden pasar cualquier companyId
 *             (tienen asignaciones de contexto que lo permiten en la matriz).
 */
@Injectable()
export class GetOperationalKpisHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetOperationalKpisQuery): Promise<OperationalKpisResult> {
    validateDateRange(query.dateFrom, query.dateTo);

    // 1. Validar contexto empresa/sede (deny-by-default).
    const ctx = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    // 2. Verificar permiso REPORT.READ_OPERATIONAL (ADM-02 matriz).
    await this.matrixAuth.assertAllowed(
      ctx.organizationId,
      ctx.roleId,
      'REPORT',
      'READ_OPERATIONAL',
      { companyId: ctx.companyId, branchId: ctx.branchId },
    );

    const operatingCompanyId = ctx.companyId;
    const branchFilter = { branchId: query.branchId };

    // 3. KPIs en tiempo real (sin filtro de fecha — snapshot actual).
    const [
      activeRentals,
      activeReservations,
      pendingReturns,
      availableVehicles,
      totalVehicles,
      activeFleetVehicles,
      openIncidents,
    ] = await Promise.all([
      // BR-REP-004: alquileres ACTIVE o RETURN_IN_PROGRESS de la empresa.
      this.prisma.rental.count({
        where: {
          operatingCompanyId,
          ...branchFilter,
          status: { in: ['ACTIVE', 'EXTENSION_PENDING', 'RETURN_IN_PROGRESS'] },
        },
      }),
      // Reservas CONFIRMED de la empresa.
      this.prisma.reservation.count({
        where: {
          operatingCompanyId,
          ...branchFilter,
          status: 'CONFIRMED',
        },
      }),
      // Devoluciones pendientes (PROGRAMADA o RECEPCION_PROVISIONAL).
      this.prisma.rentalReturn.count({
        where: {
          operatingCompanyId,
          ...branchFilter,
          status: { in: ['PROGRAMADA', 'RECEPCION_PROVISIONAL'] },
        },
      }),
      // Vehículos AVAILABLE.
      this.prisma.vehicle.count({
        where: { operatingCompanyId, status: 'AVAILABLE' },
      }),
      // Total vehículos de la empresa (para tasa de ocupación).
      this.prisma.vehicle.count({
        where: { operatingCompanyId },
      }),
      // Vehículos en uso activo (RENTED).
      this.prisma.vehicle.count({
        where: { operatingCompanyId, status: 'RENTED' },
      }),
      // Incidencias ABIERTA.
      this.prisma.incident.count({
        where: {
          operatingCompanyId,
          ...branchFilter,
          status: 'ABIERTA',
        },
      }),
    ]);

    // 4. Alquileres iniciados por día en el período (dailyRentals).
    const dailyRentalsRaw = await this.prisma.rental.findMany({
      where: {
        operatingCompanyId,
        ...branchFilter,
        startAt: {
          gte: query.dateFrom,
          lte: query.dateTo,
        },
      },
      select: { startAt: true },
    });

    const dailyMap = new Map<string, number>();
    for (const r of dailyRentalsRaw) {
      if (r.startAt) {
        const dateKey = toLimaDateString(r.startAt);
        dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
      }
    }
    const dailyRentals = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const fleetOccupancyRate = totalVehicles > 0 ? activeFleetVehicles / totalVehicles : 0;

    return {
      companyId: operatingCompanyId,
      branchId: query.branchId,
      dateFrom: toLimaDateString(query.dateFrom),
      dateTo: toLimaDateString(query.dateTo),
      kpis: {
        activeRentals,
        activeReservations,
        pendingReturns,
        availableVehicles,
        openIncidents,
        fleetOccupancyRate: Math.round(fleetOccupancyRate * 10000) / 10000,
        dailyRentals,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
