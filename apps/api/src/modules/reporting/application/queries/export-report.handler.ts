import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { ExportReportQuery } from './export-report.query';
import { validateDateRange } from './reporting.utils';

export interface ExportReportResult {
  csv: string;
  filename: string;
}

/**
 * REP-01 — Exportación CSV del período.
 *
 * BR-REP-003: requiere REPORT.EXPORT.
 * BR-REP-004: aislamiento multiempresa.
 * BR-REP-005: rango máximo 90 días.
 *
 * El CSV incluye datos de garantías (UC-REP-003 SDD-REP-001):
 * rentalId, status, originalAmount, adjustments, closedAt.
 * No incluye datos biométricos ni documentos completos.
 */
@Injectable()
export class ExportReportHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ExportReportQuery): Promise<ExportReportResult> {
    validateDateRange(query.dateFrom, query.dateTo);

    const ctx = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    await this.matrixAuth.assertAllowed(
      ctx.organizationId,
      ctx.roleId,
      'REPORT',
      'EXPORT',
      { companyId: ctx.companyId, branchId: ctx.branchId },
    );

    const operatingCompanyId = ctx.companyId;
    const branchFilter = { branchId: query.branchId };

    const rows: string[][] = [
      ['Tipo', 'Valor', 'Periodo', 'Empresa'],
    ];

    if (query.type === 'operational' || query.type === 'combined') {
      const [activeRentals, activeReservations, pendingReturns, availableVehicles, openIncidents] =
        await Promise.all([
          this.prisma.rental.count({
            where: { operatingCompanyId, ...branchFilter, status: { in: ['ACTIVE', 'EXTENSION_PENDING', 'RETURN_IN_PROGRESS'] } },
          }),
          this.prisma.reservation.count({
            where: { operatingCompanyId, ...branchFilter, status: 'CONFIRMED' },
          }),
          this.prisma.rentalReturn.count({
            where: { operatingCompanyId, ...branchFilter, status: { in: ['PROGRAMADA', 'RECEPCION_PROVISIONAL'] } },
          }),
          this.prisma.vehicle.count({ where: { operatingCompanyId, status: 'AVAILABLE' } }),
          this.prisma.incident.count({ where: { operatingCompanyId, ...branchFilter, status: 'ABIERTA' } }),
        ]);

      const periodo = `${query.dateFrom.toISOString().slice(0, 10)}_${query.dateTo.toISOString().slice(0, 10)}`;
      rows.push(['Alquileres activos', String(activeRentals), periodo, operatingCompanyId]);
      rows.push(['Reservas activas', String(activeReservations), periodo, operatingCompanyId]);
      rows.push(['Devoluciones pendientes', String(pendingReturns), periodo, operatingCompanyId]);
      rows.push(['Vehiculos disponibles', String(availableVehicles), periodo, operatingCompanyId]);
      rows.push(['Incidencias abiertas', String(openIncidents), periodo, operatingCompanyId]);
    }

    if (query.type === 'financial' || query.type === 'combined') {
      const rentalCompanyFilter = { rental: { operatingCompanyId } };

      const [heldAgg, retainedAgg, returnedAgg] = await Promise.all([
        this.prisma.rentalDeposit.aggregate({
          _sum: { originalAmount: true },
          where: { ...rentalCompanyFilter, status: 'HELD' },
        }),
        this.prisma.rentalDeposit.aggregate({
          _sum: { originalAmount: true },
          where: {
            ...rentalCompanyFilter,
            status: 'RETAINED',
            rental: { operatingCompanyId, updatedAt: { gte: query.dateFrom, lte: query.dateTo } },
          },
        }),
        this.prisma.rentalDepositAdjustment.aggregate({
          _sum: { amount: true },
          where: {
            deposit: rentalCompanyFilter,
            type: 'RELEASE',
            createdAt: { gte: query.dateFrom, lte: query.dateTo },
          },
        }),
      ]);

      const periodo = `${query.dateFrom.toISOString().slice(0, 10)}_${query.dateTo.toISOString().slice(0, 10)}`;
      rows.push(['Garantias en custodia (HELD)', String(Number(heldAgg._sum.originalAmount ?? 0)), periodo, operatingCompanyId]);
      rows.push(['Garantias retenidas (RETAINED)', String(Number(retainedAgg._sum.originalAmount ?? 0)), periodo, operatingCompanyId]);
      rows.push(['Garantias devueltas (RELEASE)', String(Number(returnedAgg._sum.amount ?? 0)), periodo, operatingCompanyId]);
    }

    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const from = query.dateFrom.toISOString().slice(0, 10);
    const to = query.dateTo.toISOString().slice(0, 10);
    const filename = `reporte-${from}_${to}.csv`;

    return { csv, filename };
  }
}
