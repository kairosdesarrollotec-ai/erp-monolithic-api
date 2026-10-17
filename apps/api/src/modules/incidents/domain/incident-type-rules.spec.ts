import { assertManagementDecisionAllowed, assertSeverityAllowedForType } from './incident-rules';

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
