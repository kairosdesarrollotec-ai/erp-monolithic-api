import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReturnDepositSettlementPort } from '../../application/ports/return-deposit-settlement.port';
import { ReturnDepositAlreadySettledError } from '../../domain/return-errors';
import { DepositAdjustmentDraft, DepositSettlementStatus } from '../../domain/return-settlement';

/**
 * Escribe sobre la garantía del Alquiler (rental_deposits / rental_deposit_adjustments, append-only) usando
 * la MISMA transacción del handler. Es la integración real con Rentals para BR-DEV-001/BR-DEV-011.
 */
@Injectable()
export class PrismaReturnDepositSettlementPersistence implements ReturnDepositSettlementPort {
  async recordImmobilizationCharge(
    input: { rentalId: string; amount: number; reason: string; authorizedBy: string },
    tx: Prisma.TransactionClient,
  ): Promise<{ applied: boolean }> {
    const deposit = await tx.rentalDeposit.findUnique({ where: { rentalId: input.rentalId } });
    if (!deposit) return { applied: false };

    await tx.rentalDepositAdjustment.create({
      data: {
        depositId: deposit.id,
        type: 'IMMOBILIZATION_CHARGE',
        amount: input.amount,
        reason: input.reason.slice(0, 500),
        authorizedBy: input.authorizedBy,
      },
    });
    return { applied: true };
  }

  async settleDeposit(
    input: {
      rentalId: string;
      status: DepositSettlementStatus;
      adjustments: DepositAdjustmentDraft[];
      authorizedBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ applied: boolean }> {
    const deposit = await tx.rentalDeposit.findUnique({ where: { rentalId: input.rentalId } });
    if (!deposit) return { applied: false };
    if (deposit.status !== 'HELD') {
      throw new ReturnDepositAlreadySettledError(deposit.status);
    }

    if (input.adjustments.length > 0) {
      await tx.rentalDepositAdjustment.createMany({
        data: input.adjustments.map((adjustment) => ({
          depositId: deposit.id,
          type: adjustment.type,
          amount: adjustment.amount,
          reason: adjustment.reason.slice(0, 500),
          authorizedBy: input.authorizedBy,
        })),
      });
    }
    await tx.rentalDeposit.update({ where: { id: deposit.id }, data: { status: input.status } });
    return { applied: true };
  }
}
