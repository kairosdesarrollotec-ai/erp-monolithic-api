import {
  computeImmobilizationAlert,
  computeReturnAlerts,
  computeWarrantyReleaseAlert,
  AlertSubject,
} from './return-alerts';

const RECEIVED = new Date('2026-10-05T12:00:00.000Z');
const at = (hoursAfterReception: number): Date => new Date(RECEIVED.getTime() + hoursAfterReception * 3_600_000);

function subject(overrides: Partial<AlertSubject> = {}): AlertSubject {
  return { status: 'SIN_DANOS', receivedAt: RECEIVED, vehicleDailyRate: 120, damages: [], immobilizationCharges: [], ...overrides };
}

describe('Alerta de liberación de garantía a las 24 h (BR-DEV-001, SC-DEV-001.02)', () => {
  it('sin alerta mientras falten más de 4 h para el límite', () => {
    expect(computeWarrantyReleaseAlert(subject(), at(19.9))).toBeNull();
  });

  it('DUE_SOON cuando faltan 4 h o menos', () => {
    const alert = computeWarrantyReleaseAlert(subject(), at(20));
    expect(alert).toMatchObject({ level: 'DUE_SOON', hoursRemaining: 4 });
    expect(alert?.deadlineAt).toEqual(at(24));
  });

  it('OVERDUE al llegar o pasar las 24 h naturales', () => {
    expect(computeWarrantyReleaseAlert(subject(), at(24))).toMatchObject({ level: 'OVERDUE', hoursRemaining: 0 });
    expect(computeWarrantyReleaseAlert(subject(), at(30))).toMatchObject({ level: 'OVERDUE', hoursRemaining: -6 });
  });

  it('solo aplica a SIN_DANOS: con daños (SC-DEV-001.03) o con cierre financiero ya hecho no alerta', () => {
    for (const status of ['CON_DANOS', 'CIERRE_FINANCIERO', 'CERRADA', 'INSPECCION', 'PROGRAMADA'] as const) {
      expect(computeWarrantyReleaseAlert(subject({ status }), at(48))).toBeNull();
    }
  });

  it('sin fecha de recepción no alerta', () => {
    expect(computeWarrantyReleaseAlert(subject({ receivedAt: null }), at(48))).toBeNull();
  });
});

describe('Alerta de inmovilización > 24 h sin cobro (BR-DEV-011)', () => {
  const technical = { origin: 'TECHNICAL' as const };
  const withTech = (extra: Partial<AlertSubject> = {}) => subject({ status: 'CON_DANOS', damages: [technical], ...extra });

  it('no alerta hasta superar las 24 h naturales', () => {
    expect(computeImmobilizationAlert(withTech(), at(24))).toBeNull();
  });

  it('alerta pasadas las 24 h: 1 día pendiente y monto sugerido con el dailyRate del vehículo', () => {
    const alert = computeImmobilizationAlert(withTech(), at(30));
    expect(alert).toMatchObject({ pendingDays: 1, dailyRate: 120, suggestedAmount: 120, since: RECEIVED });
    expect(alert?.hoursElapsed).toBe(30);
  });

  it('descuenta los días ya cobrados; si todo está cobrado no alerta', () => {
    expect(computeImmobilizationAlert(withTech({ immobilizationCharges: [{ daysCharged: 1 }] }), at(30))).toBeNull();
    // 24 + 48 = 72 h -> excesos 48 h -> 2 días; cobrado 1 -> pendiente 1
    expect(computeImmobilizationAlert(withTech({ immobilizationCharges: [{ daysCharged: 1 }] }), at(72))).toMatchObject({
      pendingDays: 1,
    });
  });

  it('sin dailyRate vigente alerta igual, sin monto sugerido', () => {
    expect(computeImmobilizationAlert(withTech({ vehicleDailyRate: null }), at(30))).toMatchObject({
      pendingDays: 1,
      dailyRate: null,
      suggestedAmount: null,
    });
  });

  it('requiere daño TÉCNICO y estado CON_DANOS | CIERRE_FINANCIERO', () => {
    expect(computeImmobilizationAlert(subject({ status: 'CON_DANOS', damages: [{ origin: 'AESTHETIC' }] }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'CERRADA' }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'SIN_DANOS' }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'CIERRE_FINANCIERO' }), at(48))).not.toBeNull();
    expect(computeImmobilizationAlert(withTech({ receivedAt: null }), at(48))).toBeNull();
  });

  it('computeReturnAlerts combina ambas alertas de forma independiente', () => {
    expect(computeReturnAlerts(subject(), at(25))).toEqual({
      warrantyRelease: expect.objectContaining({ level: 'OVERDUE' }),
      immobilization: null,
    });
    expect(computeReturnAlerts(withTech(), at(25))).toEqual({
      warrantyRelease: null,
      immobilization: expect.objectContaining({ pendingDays: 1 }),
    });
  });
});
