import {
  calculateImmobilizationCharge,
  calculateFuelPenalty,
  calculateFuelPenaltyByLines,
} from './damage-calculator';
import {
  getCosmeticDamageRate,
  isKnownCosmeticZone,
  normalizeZoneCode,
} from './cosmetic-damage-rate';

describe('Damage and Tariff calculations', () => {
  describe('Cosmetic Damage Tariff (BDD Tabla 9.6.1)', () => {
    it('resuelve precios oficiales de paños estéticos', () => {
      expect(getCosmeticDamageRate('PULIDO_Y_ENCERADO')).toBe(30.0);
      expect(getCosmeticDamageRate('ESPEJOS')).toBe(100.0);
      expect(getCosmeticDamageRate('CAPOT')).toBe(200.0);
      expect(getCosmeticDamageRate('MALETERA')).toBe(250.0);
      expect(getCosmeticDamageRate('puerta_conductor')).toBe(180.0);
      expect(getCosmeticDamageRate('TECHO')).toBe(180.0);
      expect(getCosmeticDamageRate('COMBUSTIBLE_POR_LINEA')).toBe(50.0);
    });

    it('devuelve null para zonas desconocidas o técnicas', () => {
      expect(getCosmeticDamageRate('MOTOR')).toBeNull();
      expect(getCosmeticDamageRate('FRENOS')).toBeNull();
      expect(isKnownCosmeticZone('SUSPENSION')).toBe(false);
    });
  });

  describe('Immobilization Charge (BR-DEV-011)', () => {
    const dailyRate = 120.0;
    const baseDate = new Date('2026-10-01T10:00:00Z');

    it('no aplica cobro si han transcurrido 24h o menos', () => {
      const within24h = new Date('2026-10-02T10:00:00Z'); // exactamente 24h
      const result = calculateImmobilizationCharge(baseDate, within24h, dailyRate);
      expect(result.eligible).toBe(false);
      expect(result.daysCharged).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('aplica cobro de 1 día si supera las 24h por hasta 24h adicionales', () => {
      const after30h = new Date('2026-10-02T16:00:00Z'); // 30h (6h de exceso)
      const result = calculateImmobilizationCharge(baseDate, after30h, dailyRate);
      expect(result.eligible).toBe(true);
      expect(result.daysCharged).toBe(1);
      expect(result.totalAmount).toBe(120.0);
    });

    it('aplica cobro de 2 días si supera las 48h desde la recepción', () => {
      const after52h = new Date('2026-10-03T14:00:00Z'); // 52h (28h de exceso)
      const result = calculateImmobilizationCharge(baseDate, after52h, dailyRate);
      expect(result.eligible).toBe(true);
      expect(result.daysCharged).toBe(2);
      expect(result.totalAmount).toBe(240.0);
    });
  });

  describe('Fuel Penalty calculation', () => {
    it('cobra penalidad por línea faltante según nivel de combustible', () => {
      expect(calculateFuelPenalty('FULL')).toBe(0);
      expect(calculateFuelPenalty('THREE_QUARTERS')).toBe(50.0);
      expect(calculateFuelPenalty('HALF')).toBe(100.0);
      expect(calculateFuelPenalty('ONE_QUARTER')).toBe(150.0);
      expect(calculateFuelPenalty('EMPTY')).toBe(200.0);
    });
  });
});

describe('calculateFuelPenaltyByLines (decisión 28-oct #1)', () => {
  it('líneas faltantes entre entrega y devolución x precio por línea del vehículo', () => {
    expect(calculateFuelPenaltyByLines(16, 12, 12.5)).toBe(50);
    expect(calculateFuelPenaltyByLines(16, 0, 10)).toBe(160);
  });
  it('no hay multa si devuelve con igual o más combustible', () => {
    expect(calculateFuelPenaltyByLines(8, 8, 10)).toBe(0);
    expect(calculateFuelPenaltyByLines(8, 16, 10)).toBe(0);
  });
  it('devuelve null sin lecturas o sin precio por línea (se usa el cálculo anterior)', () => {
    expect(calculateFuelPenaltyByLines(null, 8, 10)).toBeNull();
    expect(calculateFuelPenaltyByLines(16, null, 10)).toBeNull();
    expect(calculateFuelPenaltyByLines(16, 8, null)).toBeNull();
    expect(calculateFuelPenaltyByLines(16, 8, 0)).toBeNull();
  });
});
