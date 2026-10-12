import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { PaymentAccessService } from '../services/payment-access.service';
import { GetDepositsSummaryQuery } from './get-deposits-summary.query';

export interface DepositsSummaryResult {
  held: number;
  returned: number;
  retained: number;
  partiallyRetained: number;
  totalAmount: number;
  heldAmount: number;
}

/**
 * PAG-01 — resumen agregado por estado (BR-PAG-007 PAYMENT.READ_LIST).
 * Usado para las tarjetas de totales en la bandeja de garantias.
 */
@Injectable()
export class GetDepositsSummaryHandler {
  constructor(
    private readonly access: PaymentAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetDepositsSummaryQuery): Promise<DepositsSummaryResult> {
    const { scope } = await this.access.authorize(query, 'READ_LIST');

    const groups = await this.prisma.rentalDeposit.groupBy({
      by: ['status'],
      where: {
        rental: {
          operatingCompanyId: scope.companyId,
          branchId: scope.branchId,
        },
      },
      _count: { id: true },
      _sum: { originalAmount: true },
    });

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const g of groups) {
      byStatus[g.status] = {
        count: g._count.id,
        amount: g._sum.originalAmount ? Number(g._sum.originalAmount) : 0,
      };
    }

    const totalAmount = Object.values(byStatus).reduce((acc, g) => acc + g.amount, 0);

    return {
      held: byStatus['HELD']?.count ?? 0,
      returned: byStatus['RETURNED']?.count ?? 0,
      retained: byStatus['RETAINED']?.count ?? 0,
      partiallyRetained: byStatus['PARTIALLY_RETAINED']?.count ?? 0,
      totalAmount,
      heldAmount: byStatus['HELD']?.amount ?? 0,
    };
  }
}
