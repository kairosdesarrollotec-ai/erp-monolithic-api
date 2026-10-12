import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import type { FinancialKpisResult } from '../../presentation/http/dto/financial-kpis.response';
import { GetFinancialKpisQuery } from './get-financial-kpis.query';
import { validateDateRange } from './reporting.utils';

/**
 * REP-01 — KPIs financieros del período.
 *
 * BR-REP-002: requiere REPORT.READ_FINANCIAL.
 * BR-REP-004: aislamiento multiempresa — todas las queries filtran por operatingCompanyId via JOIN con rentals.
 * BR-REP-005: rango máximo 90 días.
 *
 * Fuente de datos (TDD-REP-001 §3):
 *   - rentalRevenue: suma de rental_deposits.originalAmount para alquileres CLOSED en el período
 *     (proxy: no existe campo monto_total en la tabla rentals del MVP — OQ-REP-002 documenta la limitación).
 *   - depositsHeld: suma de originalAmount WHERE status='HELD' (snapshot actual).
 *   - depositsReturned: suma de adjustments WHERE type='RELEASE' en el período.
 *   - depositsRetained: suma de originalAmount WHERE status='RETAINED' cerrados en el período.
 *   - depositsPartiallyRetained: suma neta retenida en garantías PARTIALLY_RETAINED del período.
 */
@Injectable()
export class GetFinancialKpisHandler {
  constructor(
    private readonly workContext: WorkContextAuthorizationService,
    private readonly matrixAuth: MatrixAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetFinancialKpisQuery): Promise<FinancialKpisResult> {
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
      'READ_FINANCIAL',
      { companyId: ctx.companyId, branchId: ctx.branchId },
    );

    const operatingCompanyId = ctx.companyId;
    const rentalCompanyFilter = { rental: { operatingCompanyId } };

    // Ingresos: suma de originalAmount de depósitos cuyo alquiler cerró en el período.
    const revenueAgg = await this.prisma.rentalDeposit.aggregate({
      _sum: { originalAmount: true },
      where: {
        ...rentalCompanyFilter,
        rental: {
          operatingCompanyId,
          status: 'CLOSED',
          updatedAt: { gte: query.dateFrom, lte: query.dateTo },
        },
      },
    });

    // Garantías actuales en custodia (HELD) — snapshot.
    const heldAgg = await this.prisma.rentalDeposit.aggregate({
      _sum: { originalAmount: true },
      where: { ...rentalCompanyFilter, status: 'HELD' },
    });

    // Garantías devueltas en el período: ajustes tipo RELEASE.
    const returnedAgg = await this.prisma.rentalDepositAdjustment.aggregate({
      _sum: { amount: true },
      where: {
        deposit: rentalCompanyFilter,
        type: 'RELEASE',
        createdAt: { gte: query.dateFrom, lte: query.dateTo },
      },
    });

    // Garantías retenidas definitivamente (RETAINED) cerradas en el período.
    const retainedAgg = await this.prisma.rentalDeposit.aggregate({
      _sum: { originalAmount: true },
      where: {
        ...rentalCompanyFilter,
        status: 'RETAINED',
        rental: {
          operatingCompanyId,
          updatedAt: { gte: query.dateFrom, lte: query.dateTo },
        },
      },
    });

    // Garantías parcialmente retenidas (PARTIALLY_RETAINED) — monto neto retenido vía adjustments DISCOUNT.
    const partialRetainedAgg = await this.prisma.rentalDepositAdjustment.aggregate({
      _sum: { amount: true },
      where: {
        deposit: { ...rentalCompanyFilter, status: 'PARTIALLY_RETAINED' },
        type: 'DISCOUNT',
        createdAt: { gte: query.dateFrom, lte: query.dateTo },
      },
    });

    const rentalRevenue = Number(revenueAgg._sum.originalAmount ?? 0);
    const depositsHeld = Number(heldAgg._sum.originalAmount ?? 0);
    const depositsReturned = Number(returnedAgg._sum.amount ?? 0);
    const depositsRetained = Number(retainedAgg._sum.originalAmount ?? 0);
    const depositsPartiallyRetained = Number(partialRetainedAgg._sum.amount ?? 0);
    const netDepositsRetained = depositsRetained + depositsPartiallyRetained;

    return {
      companyId: operatingCompanyId,
      branchId: query.branchId,
      dateFrom: query.dateFrom.toISOString().slice(0, 10),
      dateTo: query.dateTo.toISOString().slice(0, 10),
      kpis: {
        rentalRevenue,
        depositsHeld,
        depositsReturned,
        depositsRetained,
        depositsPartiallyRetained,
        netDepositsRetained,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
