import { InvalidFinancialSettlementError } from './return-errors';
import { roundMoney } from './return-rules';

export type DepositAdjustmentType = 'DISCOUNT' | 'FULL_RETENTION' | 'RELEASE' | 'IMMOBILIZATION_CHARGE';
export type DepositSettlementStatus = 'RETURNED' | 'RETAINED' | 'PARTIALLY_RETAINED';

export interface DepositAdjustmentDraft {
  type: DepositAdjustmentType;
  amount: number;
  reason: string;
}

export interface DepositSettlementPlan {
  status: DepositSettlementStatus;
  adjustments: DepositAdjustmentDraft[];
}

/**
 * BR-DEV-001 / DEV-08: la liquidación debe repartir exactamente la garantía retenida (reembolso + retención)
 * y la retención debe cubrir los cargos de paralización ya imputados (BR-DEV-011, que ya generaron su
 * ajuste IMMOBILIZATION_CHARGE). El resto de la retención se registra como DISCOUNT o FULL_RETENTION.
 */
export function buildDepositSettlementPlan(params: {
  originalAmount: number;
  refundAmount: number;
  retainedAmount: number;
  immobilizationTotal: number;
  lateChargeAmount?: number | null;
  fuelPenaltyAmount?: number | null;
}): DepositSettlementPlan {
  const original = roundMoney(params.originalAmount);
  const refund = roundMoney(params.refundAmount);
  const retained = roundMoney(params.retainedAmount);
  const immobilization = roundMoney(params.immobilizationTotal);
  const lateCharge = roundMoney(params.lateChargeAmount ?? 0);
  const fuelPenalty = roundMoney(params.fuelPenaltyAmount ?? 0);
  const priorCharges = roundMoney(immobilization + lateCharge + fuelPenalty);

  if (roundMoney(refund + retained) !== original) {
    throw new InvalidFinancialSettlementError(
      `El reembolso (${refund.toFixed(2)}) más lo retenido (${retained.toFixed(2)}) debe ser igual a la garantía constituida (${original.toFixed(2)}).`,
    );
  }
  if (retained < priorCharges) {
    if (fuelPenalty > 0 && lateCharge > 0 && immobilization > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre los cargos ya imputados de paralización (${immobilization.toFixed(2)}), retraso (${lateCharge.toFixed(2)}) y multa de combustible (${fuelPenalty.toFixed(2)}) (total: ${priorCharges.toFixed(2)}).`,
      );
    }
    if (fuelPenalty > 0 && lateCharge > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre los cargos de retraso (${lateCharge.toFixed(2)}) y multa de combustible (${fuelPenalty.toFixed(2)}) (total: ${priorCharges.toFixed(2)}).`,
      );
    }
    if (fuelPenalty > 0 && immobilization > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre los cargos de paralización (${immobilization.toFixed(2)}) y multa de combustible (${fuelPenalty.toFixed(2)}) (total: ${priorCharges.toFixed(2)}).`,
      );
    }
    if (fuelPenalty > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre la multa por combustible (${fuelPenalty.toFixed(2)}).`,
      );
    }
    if (lateCharge > 0 && immobilization > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre los cargos ya imputados de paralización (${immobilization.toFixed(2)}) y retraso (${lateCharge.toFixed(2)}) (total: ${priorCharges.toFixed(2)}).`,
      );
    }
    if (lateCharge > 0) {
      throw new InvalidFinancialSettlementError(
        `Lo retenido (${retained.toFixed(2)}) no cubre el cargo por retraso ya registrado (${lateCharge.toFixed(2)}).`,
      );
    }
    throw new InvalidFinancialSettlementError(
      `Lo retenido (${retained.toFixed(2)}) no cubre los cargos de paralización ya imputados (${immobilization.toFixed(2)}) (BR-DEV-011).`,
    );
  }

  const adjustments: DepositAdjustmentDraft[] = [];
  if (refund > 0) {
    adjustments.push({ type: 'RELEASE', amount: refund, reason: 'Liberación de garantía por devolución' });
  }
  const damageRetention = roundMoney(retained - immobilization);
  if (damageRetention > 0) {
    adjustments.push(
      retained === original
        ? { type: 'FULL_RETENTION', amount: damageRetention, reason: 'Retención total de garantía por devolución' }
        : { type: 'DISCOUNT', amount: damageRetention, reason: 'Descuento de garantía por daños/penalidades de devolución' },
    );
  }

  const status: DepositSettlementStatus = retained === 0 ? 'RETURNED' : refund === 0 ? 'RETAINED' : 'PARTIALLY_RETAINED';
  return { status, adjustments };
}
