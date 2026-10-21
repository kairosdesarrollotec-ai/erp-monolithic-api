import { assertDecisionOutcomeForType, assertManagementDecisionAllowed, assertSeverityAllowedForType, describeDecisionOutcome } from './incident-rules';

describe('DEC-ALQ-UNAUTH-DRIVER-003 - reglas por tipo', () => {
  it('UNAUTHORIZED_DRIVER solo admite GRAVE; el resto de tipos acepta cualquier severidad', () => {
    expect(() => assertSeverityAllowedForType('UNAUTHORIZED_DRIVER', 'GRAVE')).not.toThrow();
    expect(() => assertSeverityAllowedForType('UNAUTHORIZED_DRIVER', 'MODERADA')).toThrow();
    expect(() => assertSeverityAllowedForType('KEY_LOSS', 'LEVE')).not.toThrow();
  });

  it('la decision (resolver/cerrar/derivar) exige rol GERENCIA; ACTION queda abierta; rol sin clave de sistema queda excluido', () => {
    for (const kind of ['RESOLVED', 'CLOSED', 'REFERRED_LEGAL'] as const) {
      expect(() => assertManagementDecisionAllowed('UNAUTHORIZED_DRIVER', kind, 'GERENCIA')).not.toThrow();
      expect(() => assertManagementDecisionAllowed('UNAUTHORIZED_DRIVER', kind, 'FRONT_OFFICE')).toThrow();
      expect(() => assertManagementDecisionAllowed('UNAUTHORIZED_DRIVER', kind, null)).toThrow();
    }
    expect(() => assertManagementDecisionAllowed('UNAUTHORIZED_DRIVER', 'ACTION', 'FRONT_OFFICE')).not.toThrow();
    expect(() => assertManagementDecisionAllowed('TOWING', 'CLOSED', 'FRONT_OFFICE')).not.toThrow();
  });
});

describe('resultado estructurado de la decision de Gerencia', () => {
  const outcome = { retainGuarantee: true, terminateContract: false };

  it('es obligatorio para UNAUTHORIZED_DRIVER y no aplica a los demas tipos', () => {
    expect(() => assertDecisionOutcomeForType('UNAUTHORIZED_DRIVER', outcome)).not.toThrow();
    expect(() => assertDecisionOutcomeForType('UNAUTHORIZED_DRIVER', undefined)).toThrow();
    expect(() => assertDecisionOutcomeForType('KEY_LOSS', undefined)).not.toThrow();
    expect(() => assertDecisionOutcomeForType('KEY_LOSS', outcome)).toThrow();
  });

  it('describeDecisionOutcome cubre las cuatro combinaciones', () => {
    expect(describeDecisionOutcome({ retainGuarantee: false, terminateContract: false })).toBe(
      'Decision de Gerencia: no se retiene la garantia; se mantiene el contrato.',
    );
    expect(describeDecisionOutcome(outcome)).toBe('Decision de Gerencia: se retiene la garantia; se mantiene el contrato.');
    expect(describeDecisionOutcome({ retainGuarantee: false, terminateContract: true })).toBe(
      'Decision de Gerencia: no se retiene la garantia; se resuelve el contrato.',
    );
    expect(describeDecisionOutcome({ retainGuarantee: true, terminateContract: true })).toBe(
      'Decision de Gerencia: se retiene la garantia; se resuelve el contrato.',
    );
  });
});
