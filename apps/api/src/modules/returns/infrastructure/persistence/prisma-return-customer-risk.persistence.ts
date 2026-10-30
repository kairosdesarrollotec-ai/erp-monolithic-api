import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReturnCustomerRiskPort } from '../../application/ports/return-customer-risk.port';
import {
  CustomerRiskStatus,
  escalateCustomerRiskStatus,
  normalizeCustomerRiskStatus,
  riskStatusesAtOrAbove,
} from '../../domain/customer-risk-status';

/**
 * Escribe Customer.status (mismo campo que usa Alquiler en report-extension-breach para ROJO). El UPDATE
 * condicional (`status NOT IN (estados >= objetivo)`) garantiza el solo-avance incluso con escrituras concurrentes.
 */
@Injectable()
export class PrismaReturnCustomerRiskPersistence implements ReturnCustomerRiskPort {
  async escalate(
    input: { customerId: string; organizationId: string; operatingCompanyId: string; target: CustomerRiskStatus; reason?: string },
    tx: Prisma.TransactionClient,
  ): Promise<{ previous: CustomerRiskStatus; current: CustomerRiskStatus }> {
    const where = { id: input.customerId, organizationId: input.organizationId, operatingCompanyId: input.operatingCompanyId };
    const before = await tx.customer.findFirst({ where, select: { status: true } });
    const previous = normalizeCustomerRiskStatus(before?.status);
    if (!before || escalateCustomerRiskStatus(previous, input.target) === previous) {
      return { previous, current: previous };
    }

    await tx.customer.updateMany({
      where: { ...where, status: { notIn: riskStatusesAtOrAbove(input.target) } },
      data: { status: input.target, statusReason: input.reason?.slice(0, 500) ?? null, statusChangedAt: new Date() },
    });
    const after = await tx.customer.findFirst({ where, select: { status: true } });
    return { previous, current: normalizeCustomerRiskStatus(after?.status) };
  }
}
