import {
  evaluateNotaryMatrix,
  NOTARY_POLICY_VERSION,
  PROHIBITED_NOTARY_EXEMPTION_MODELS,
} from './notary-matrix-policy';

describe('evaluateNotaryMatrix', () => {
  it('vehiculos prohibidos por alta siniestralidad (BR-ALQ-003) siempre devuelven MANDATORY sin excepcion', () => {
    for (const model of PROHIBITED_NOTARY_EXEMPTION_MODELS) {
      const output = evaluateNotaryMatrix({
        vehicleModel: `Toyota ${model} 4x4`,
        previousRentalsCount: 5,
        biometricVerified: true,
      });

      expect(output.result).toBe('MANDATORY');
      expect(output.requiresApproval).toBe(false);
      expect(output.policyVersion).toBe(NOTARY_POLICY_VERSION);
      expect(output.reason).toContain('alto riesgo');
    }
  });

  it('cliente recurrente (> 2 alquileres) con biometria verificada es elegible para tercer camino (BR-ALQ-004)', () => {
    const output = evaluateNotaryMatrix({
      vehicleModel: 'Nissan Versa',
      previousRentalsCount: 3,
      biometricVerified: true,
      scoreRiskLevel: 'LOW',
    });

    expect(output.result).toBe('THIRD_PATH_ELIGIBLE');
    expect(output.requiresApproval).toBe(true);
    expect(output.approverRole).toBe('GERENCIA');
  });

  it('cliente recurrente con riesgo ALTO no accede a tercer camino y requiere notaria MANDATORY', () => {
    const output = evaluateNotaryMatrix({
      vehicleModel: 'Kia Rio',
      previousRentalsCount: 4,
      biometricVerified: true,
      scoreRiskLevel: 'HIGH',
    });

    expect(output.result).toBe('MANDATORY');
    expect(output.requiresApproval).toBe(false);
  });

  it('cliente nuevo (<= 2 alquileres) requiere DOUBLE_DEPOSIT', () => {
    const output = evaluateNotaryMatrix({
      vehicleModel: 'Hyundai Accent',
      previousRentalsCount: 2,
      biometricVerified: true,
    });

    expect(output.result).toBe('DOUBLE_DEPOSIT');
    expect(output.requiresApproval).toBe(false);
  });

  it('cliente sin biometria verificada requiere DOUBLE_DEPOSIT', () => {
    const output = evaluateNotaryMatrix({
      vehicleModel: 'Suzuki Swift',
      previousRentalsCount: 5,
      biometricVerified: false,
    });

    expect(output.result).toBe('DOUBLE_DEPOSIT');
    expect(output.requiresApproval).toBe(false);
  });
});
