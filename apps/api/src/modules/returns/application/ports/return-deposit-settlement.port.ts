import type { Prisma } from '@prisma/client';
import { DepositAdjustmentDraft, DepositSettlementStatus } from '../../domain/return-settlement';

/**
 * Integración de Devolución con la garantía del Alquiler (TDD-DEV-001 seccion 13 `PaymentAdjustmentPort`,
 * ajustes append-only de TDD-ALQ-001 seccion 9.4). Ambas operaciones son no-op (`applied: false`) si el
 * alquiler no tiene garantía registrada.
 */
export abstract class ReturnDepositSettlementPort {
  /** BR-DEV-011: registra el ajuste IMMOBILIZATION_CHARGE sobre la garantía del alquiler. */
  abstract recordImmobilizationCharge(
    input: { rentalId: string; amount: number; reason: string; authorizedBy: string },
    tx: Prisma.TransactionClient,
  ): Promise<{ applied: boolean }>;

  /** DEV-08: aplica los ajustes de liquidación y actualiza el estado de la garantía (solo desde HELD). */
  abstract settleDeposit(
    input: {
      rentalId: string;
      status: DepositSettlementStatus;
      adjustments: DepositAdjustmentDraft[];
      authorizedBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<{ applied: boolean }>;
}
