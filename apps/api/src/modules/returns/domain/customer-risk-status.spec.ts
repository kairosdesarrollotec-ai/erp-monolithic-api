import {
  escalateCustomerRiskStatus,
  normalizeCustomerRiskStatus,
  resolveRiskTargetAfterDamage,
  riskStatusesAtOrAbove,
  CUSTOMER_RISK_STATUSES,
  CustomerRiskStatus,
} from './customer-risk-status';

describe('customer-risk-status (semáforo de solo avance, BR-DEV-008 / TD-DEV-002)', () => {
  it('normaliza valores desconocidos o legados a NORMAL', () => {
    expect(normalizeCustomerRiskStatus('SIN_OBSERVACION')).toBe('NORMAL');
    expect(normalizeCustomerRiskStatus(null)).toBe('NORMAL');
    expect(normalizeCustomerRiskStatus('AMBAR')).toBe('AMBAR');
    expect(normalizeCustomerRiskStatus('ROJO')).toBe('ROJO');
  });

  it('avanza NORMAL -> AMBAR -> ROJO', () => {
    expect(escalateCustomerRiskStatus('NORMAL', 'AMBAR')).toBe('AMBAR');
    expect(escalateCustomerRiskStatus('AMBAR', 'ROJO')).toBe('ROJO');
    expect(escalateCustomerRiskStatus('NORMAL', 'ROJO')).toBe('ROJO');
  });

  it('NUNCA degrada: ninguna combinación (actual, solicitado) produce un estado menor al actual', () => {
    const rank = (s: CustomerRiskStatus) => CUSTOMER_RISK_STATUSES.indexOf(s);
    for (const current of CUSTOMER_RISK_STATUSES) {
      for (const requested of CUSTOMER_RISK_STATUSES) {
        const result = escalateCustomerRiskStatus(current, requested);
        expect(rank(result)).toBeGreaterThanOrEqual(rank(current));
        expect(rank(result)).toBeGreaterThanOrEqual(rank(requested));
      }
    }
    expect(escalateCustomerRiskStatus('ROJO', 'NORMAL')).toBe('ROJO');
    expect(escalateCustomerRiskStatus('ROJO', 'AMBAR')).toBe('ROJO');
    expect(escalateCustomerRiskStatus('AMBAR', 'NORMAL')).toBe('AMBAR');
  });

  it('riskStatusesAtOrAbove lista los estados que no deben sobrescribirse', () => {
    expect(riskStatusesAtOrAbove('NORMAL')).toEqual(['NORMAL', 'AMBAR', 'ROJO']);
    expect(riskStatusesAtOrAbove('AMBAR')).toEqual(['AMBAR', 'ROJO']);
    expect(riskStatusesAtOrAbove('ROJO')).toEqual(['ROJO']);
  });

  describe('resolveRiskTargetAfterDamage (BR-DEV-007)', () => {
    it('GRAVE -> ROJO siempre, acepte o no el costo', () => {
      expect(resolveRiskTargetAfterDamage('GRAVE', undefined)).toBe('ROJO');
      expect(resolveRiskTargetAfterDamage('GRAVE', true)).toBe('ROJO');
      expect(resolveRiskTargetAfterDamage('GRAVE', false)).toBe('ROJO');
    });

    it('LEVE o MODERADO con customerAcceptsCost === true -> AMBAR', () => {
      expect(resolveRiskTargetAfterDamage('LEVE', true)).toBe('AMBAR');
      expect(resolveRiskTargetAfterDamage('MODERADO', true)).toBe('AMBAR');
    });

    it('MODERADO que el cliente no acepta -> AMBAR (Gerencia decide)', () => {
      expect(resolveRiskTargetAfterDamage('MODERADO', false)).toBe('AMBAR');
    });

    it('LEVE sin aceptación explícita -> sin cambio', () => {
      expect(resolveRiskTargetAfterDamage('LEVE', undefined)).toBeNull();
      expect(resolveRiskTargetAfterDamage('LEVE', false)).toBeNull();
    });
  });
});
