import {
  appendNotes,
  findOpenIncidents,
  isReturnableRentalStatus,
  requiresRedRiskStatus,
  resolveVehicleStatusAfterReturn,
  roundMoney,
} from './return-rules';
import { missingReturnEvidence } from './return-evidence-requirements';

describe('return-rules', () => {
  describe('findOpenIncidents (DR-DEV-001)', () => {
    it('CON_DANOS sin ningún daño evaluado es una incidencia abierta', () => {
      expect(findOpenIncidents('CON_DANOS', [])).toEqual(['DANOS_SIN_EVALUAR']);
    });

    it('SIN_DANOS sin daños no tiene incidencias abiertas', () => {
      expect(findOpenIncidents('SIN_DANOS', [])).toEqual([]);
    });

    it('un daño técnico sin monto del informe externo es una incidencia abierta', () => {
      const open = findOpenIncidents('CON_DANOS', [{ origin: 'TECHNICAL', severity: 'MODERADO', estimatedAmount: null }]);
      expect(open).toHaveLength(1);
      expect(open[0]).toContain('DANO_TECNICO_SIN_MONTO_DE_INFORME');
    });

    it('daños evaluados (estético con tarifario y técnico con monto) no bloquean', () => {
      expect(
        findOpenIncidents('CON_DANOS', [
          { origin: 'AESTHETIC', severity: 'LEVE', estimatedAmount: 180 },
          { origin: 'TECHNICAL', severity: 'GRAVE', estimatedAmount: 850 },
        ]),
      ).toEqual([]);
    });
  });

  it('resolveVehicleStatusAfterReturn: MAINTENANCE con daño técnico o grave; AVAILABLE en otro caso', () => {
    expect(resolveVehicleStatusAfterReturn([])).toBe('AVAILABLE');
    expect(resolveVehicleStatusAfterReturn([{ origin: 'AESTHETIC', severity: 'LEVE', estimatedAmount: 30 }])).toBe(
      'AVAILABLE',
    );
    expect(resolveVehicleStatusAfterReturn([{ origin: 'TECHNICAL', severity: 'LEVE', estimatedAmount: 1 }])).toBe(
      'MAINTENANCE',
    );
    expect(resolveVehicleStatusAfterReturn([{ origin: 'AESTHETIC', severity: 'GRAVE', estimatedAmount: 250 }])).toBe(
      'MAINTENANCE',
    );
  });

  it('requiresRedRiskStatus solo para GRAVE (BR-DEV-007)', () => {
    expect(requiresRedRiskStatus('GRAVE')).toBe(true);
    expect(requiresRedRiskStatus('MODERADO')).toBe(false);
    expect(requiresRedRiskStatus('LEVE')).toBe(false);
  });

  it('isReturnableRentalStatus: solo ACTIVE y RETURN_IN_PROGRESS', () => {
    expect(isReturnableRentalStatus('ACTIVE')).toBe(true);
    expect(isReturnableRentalStatus('RETURN_IN_PROGRESS')).toBe(true);
    expect(isReturnableRentalStatus('CLOSED')).toBe(false);
    expect(isReturnableRentalStatus('EXTENSION_PENDING')).toBe(false);
  });

  it('appendNotes conserva notas previas y descarta vacíos', () => {
    expect(appendNotes(null, undefined, '  ')).toBeUndefined();
    expect(appendNotes('previa', 'nueva')).toBe('previa\nnueva');
    expect(appendNotes(null, 'a', 'b')).toBe('a\nb');
  });

  it('roundMoney redondea a 2 decimales', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('missingReturnEvidence calcula lo que falta (35 fotos + 3 videos)', () => {
    expect(missingReturnEvidence({ photos: 35, videos: 3 })).toEqual([]);
    expect(missingReturnEvidence({ photos: 30, videos: 1 })).toEqual([
      '5 fotos restantes (mínimo 35)',
      '2 videos restantes (mínimo 3)',
    ]);
  });
});
