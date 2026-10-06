import { buildDepositSettlementPlan } from './return-settlement';
import { InvalidFinancialSettlementError } from './return-errors';

describe('buildDepositSettlementPlan (BR-DEV-001 / BR-DEV-011)', () => {
  it('devolución total de la garantía -> RETURNED con un ajuste RELEASE', () => {
    const plan = buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 500, retainedAmount: 0, immobilizationTotal: 0 });
    expect(plan.status).toBe('RETURNED');
    expect(plan.adjustments).toEqual([expect.objectContaining({ type: 'RELEASE', amount: 500 })]);
  });

  it('retención parcial -> PARTIALLY_RETAINED con RELEASE + DISCOUNT', () => {
    const plan = buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 320, retainedAmount: 180, immobilizationTotal: 0 });
    expect(plan.status).toBe('PARTIALLY_RETAINED');
    expect(plan.adjustments.map((a) => [a.type, a.amount])).toEqual([
      ['RELEASE', 320],
      ['DISCOUNT', 180],
    ]);
  });

  it('retención total -> RETAINED con FULL_RETENTION (neto de cargos de paralización ya imputados)', () => {
    const plan = buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 0, retainedAmount: 500, immobilizationTotal: 200 });
    expect(plan.status).toBe('RETAINED');
    expect(plan.adjustments).toEqual([expect.objectContaining({ type: 'FULL_RETENTION', amount: 300 })]);
  });

  it('retención igual a los cargos de paralización no duplica ajustes', () => {
    const plan = buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 400, retainedAmount: 100, immobilizationTotal: 100 });
    expect(plan.adjustments.map((a) => a.type)).toEqual(['RELEASE']);
    expect(plan.status).toBe('PARTIALLY_RETAINED');
  });

  it('reembolso + retención distinto de la garantía -> InvalidFinancialSettlementError', () => {
    expect(() =>
      buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 300, retainedAmount: 100, immobilizationTotal: 0 }),
    ).toThrow(InvalidFinancialSettlementError);
  });

  it('retención menor a los cargos de paralización ya imputados -> InvalidFinancialSettlementError', () => {
    expect(() =>
      buildDepositSettlementPlan({ originalAmount: 500, refundAmount: 450, retainedAmount: 50, immobilizationTotal: 100 }),
    ).toThrow(InvalidFinancialSettlementError);
  });
});
