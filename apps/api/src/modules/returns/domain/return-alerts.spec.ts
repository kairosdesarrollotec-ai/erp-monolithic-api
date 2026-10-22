import {
  computeImmobilizationAlert,
  computeLateChargeSuggestion,
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
  // 22-oct-2026: el reloj corre desde el CIERRE de la devolucion (CERRADA + closedAt); aqui closedAt = RECEIVED para reutilizar at().
  const withTech = (extra: Partial<AlertSubject> = {}) =>
    subject({ status: 'CERRADA', receivedAt: new Date(RECEIVED.getTime() - 48 * 3_600_000), closedAt: RECEIVED, damages: [technical], ...extra });

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

  it('requiere daño TÉCNICO y devolución CERRADA con closedAt (el reloj no corre antes del cierre)', () => {
    expect(computeImmobilizationAlert(withTech({ damages: [{ origin: 'AESTHETIC' }] }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'SIN_DANOS' }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'CON_DANOS' }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ status: 'CIERRE_FINANCIERO' }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech({ closedAt: null }), at(48))).toBeNull();
    expect(computeImmobilizationAlert(withTech(), at(48))).not.toBeNull();
  });

  it('el reloj arranca en el cierre, no en la recepción: 30 h desde la recepción pero 6 h desde el cierre no alerta', () => {
    const closedLater = withTech({ receivedAt: RECEIVED, closedAt: at(24) });
    expect(computeImmobilizationAlert(closedLater, at(30))).toBeNull();
    expect(computeImmobilizationAlert(closedLater, at(49))).toMatchObject({ pendingDays: 1, since: at(24) });
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

describe('DEC-ALQ-COMPANY-DRIVER-004 - sin garantia no hay alerta de liberacion', () => {
  it('depositRequired=false (conductor de la empresa): sin alerta aunque pasen 48 h', () => {
    expect(computeWarrantyReleaseAlert(subject({ depositRequired: false }), at(48))).toBeNull();
    expect(computeReturnAlerts(subject({ depositRequired: false }), at(48)).warrantyRelease).toBeNull();
  });

  it('depositRequired=true o ausente conserva la alerta', () => {
    expect(computeWarrantyReleaseAlert(subject({ depositRequired: true }), at(48))).toMatchObject({ level: 'OVERDUE' });
    expect(computeWarrantyReleaseAlert(subject(), at(48))).toMatchObject({ level: 'OVERDUE' });
  });
});

describe('Sugerencia de registrar el cargo por retraso manual (F-03, DEC-DEVREM-003)', () => {
  const SCHEDULED = new Date('2026-10-05T10:00:00.000Z');
  const late = (minutes: number, overrides: Partial<AlertSubject> = {}): AlertSubject =>
    subject({
      status: 'INSPECCION',
      scheduledAt: SCHEDULED,
      receivedAt: new Date(SCHEDULED.getTime() + minutes * 60_000),
      lateChargeAmount: null,
      ...overrides,
    });
  const NOW = new Date('2026-10-05T14:00:00.000Z');

  it('exactamente 30 min NO es retraso; 31 min sí (BR-DEV-003)', () => {
    expect(computeLateChargeSuggestion(late(30), NOW)).toBeNull();
    expect(computeLateChargeSuggestion(late(31), NOW)).toEqual({ lateMinutes: 31, lateToleranceMinutes: 30 });
  });

  it('no sugiere si ya se registró el cargo (se apaga sola), ni sin recepción, ni en estados no registrables', () => {
    expect(computeLateChargeSuggestion(late(90, { lateChargeAmount: 80 }), NOW)).toBeNull();
    expect(computeLateChargeSuggestion(late(90, { receivedAt: null }), NOW)).toBeNull();
    expect(computeLateChargeSuggestion(late(90, { status: 'CERRADA' }), NOW)).toBeNull();
    expect(computeLateChargeSuggestion(late(90, { status: 'PROGRAMADA' }), NOW)).toBeNull();
    expect(computeLateChargeSuggestion(late(90, { status: 'CANCELADA' }), NOW)).toBeNull();
  });

  it('aplica en todos los estados donde register-late-charge admite el cargo', () => {
    for (const status of ['RECEPCION_PROVISIONAL', 'INSPECCION', 'SIN_DANOS', 'CON_DANOS', 'CIERRE_FINANCIERO'] as const) {
      expect(computeLateChargeSuggestion(late(90, { status }), NOW)).not.toBeNull();
    }
  });

  it('es solo una sugerencia: no calcula ningún monto', () => {
    expect(Object.keys(computeLateChargeSuggestion(late(400), NOW)!).sort()).toEqual(['lateMinutes', 'lateToleranceMinutes']);
  });
});
