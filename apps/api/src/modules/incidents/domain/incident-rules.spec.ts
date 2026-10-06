import { assertDirectResolveAllowed, assertIncidentOpen, canResolveDirectly, isBlockingIncident, requireText } from './incident-rules';
import {
  IncidentDirectResolveNotAllowedError,
  IncidentInvalidTextError,
  IncidentNotFoundError,
  IncidentNotOpenError,
  IncidentRentalNotFoundError,
  IncidentReturnNotFoundError,
  IncidentVersionConflictError,
} from './incident-errors';

describe('reglas de dominio de Incidencias', () => {
  it.each([
    ['LEVE', true],
    ['MODERADA', false],
    ['GRAVE', false],
  ] as const)('resolucion directa con severidad %s -> %s', (severity, expected) => {
    expect(canResolveDirectly(severity)).toBe(expected);
    if (expected) {
      expect(() => assertDirectResolveAllowed(severity)).not.toThrow();
    } else {
      expect(() => assertDirectResolveAllowed(severity)).toThrow(IncidentDirectResolveNotAllowedError);
    }
  });

  it('solo ABIERTA admite cambios; CERRADA y VIA_LEGAL son terminales', () => {
    expect(() => assertIncidentOpen('ABIERTA')).not.toThrow();
    expect(() => assertIncidentOpen('CERRADA')).toThrow(IncidentNotOpenError);
    expect(() => assertIncidentOpen('VIA_LEGAL')).toThrow(IncidentNotOpenError);
  });

  it('solo ABIERTA bloquea la liberacion de garantia (DEV-09)', () => {
    expect(isBlockingIncident('ABIERTA')).toBe(true);
    expect(isBlockingIncident('CERRADA')).toBe(false);
    expect(isBlockingIncident('VIA_LEGAL')).toBe(false);
  });

  it('requireText recorta y rechaza vacios o solo espacios', () => {
    expect(requireText('  ya recuperada  ', 'resolutionSummary')).toBe('ya recuperada');
    expect(() => requireText('   ', 'resolutionSummary')).toThrow(IncidentInvalidTextError);
    expect(() => requireText(undefined, 'reason')).toThrow(IncidentInvalidTextError);
  });

  it('codigos y estados HTTP de los errores siguen el contrato incidents.yaml', () => {
    expect([new IncidentNotFoundError('x').code, new IncidentNotFoundError('x').httpStatus]).toEqual(['INCIDENT_NOT_FOUND', 404]);
    expect([new IncidentVersionConflictError().code, new IncidentVersionConflictError().httpStatus]).toEqual(['VERSION_CONFLICT', 409]);
    expect([new IncidentNotOpenError('CERRADA').code, new IncidentNotOpenError('CERRADA').httpStatus]).toEqual(['INCIDENT_NOT_OPEN', 409]);
    const direct = new IncidentDirectResolveNotAllowedError('GRAVE');
    expect([direct.code, direct.httpStatus]).toEqual(['INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED', 422]);
    expect(new IncidentRentalNotFoundError().httpStatus).toBe(404);
    expect(new IncidentReturnNotFoundError().httpStatus).toBe(404);
    expect(new IncidentInvalidTextError('reason').httpStatus).toBe(400);
  });
});
