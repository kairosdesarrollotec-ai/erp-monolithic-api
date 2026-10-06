import {
  canTransitionReturn,
  assertCanTransitionReturn,
  ALLOWED_RETURN_TRANSITIONS,
  ReturnStatus,
} from './return-status';
import { InvalidReturnStateTransitionError } from './return-errors';

describe('ReturnStatus domain rules', () => {
  it('permite transiciones válidas del ciclo de vida de devolución', () => {
    expect(canTransitionReturn('PROGRAMADA', 'RECEPCION_PROVISIONAL')).toBe(true);
    expect(canTransitionReturn('RECEPCION_PROVISIONAL', 'INSPECCION')).toBe(true);
    expect(canTransitionReturn('INSPECCION', 'SIN_DANOS')).toBe(true);
    expect(canTransitionReturn('INSPECCION', 'CON_DANOS')).toBe(true);
    expect(canTransitionReturn('SIN_DANOS', 'CIERRE_FINANCIERO')).toBe(true);
    expect(canTransitionReturn('CON_DANOS', 'CIERRE_FINANCIERO')).toBe(true);
    expect(canTransitionReturn('CIERRE_FINANCIERO', 'CERRADA')).toBe(true);
    expect(canTransitionReturn('PROGRAMADA', 'CANCELADA')).toBe(true);
    expect(canTransitionReturn('RECEPCION_PROVISIONAL', 'CANCELADA')).toBe(true);
  });

  it('permite transición al mismo estado (idempotencia de estado)', () => {
    const statuses: ReturnStatus[] = [
      'PROGRAMADA',
      'RECEPCION_PROVISIONAL',
      'INSPECCION',
      'SIN_DANOS',
      'CON_DANOS',
      'CIERRE_FINANCIERO',
      'CERRADA',
      'CANCELADA',
    ];
    for (const status of statuses) {
      expect(canTransitionReturn(status, status)).toBe(true);
    }
  });

  it('rechaza transiciones inválidas o regresivas', () => {
    expect(canTransitionReturn('PROGRAMADA', 'CERRADA')).toBe(false);
    expect(canTransitionReturn('RECEPCION_PROVISIONAL', 'PROGRAMADA')).toBe(false);
    expect(canTransitionReturn('CERRADA', 'INSPECCION')).toBe(false);
    expect(canTransitionReturn('CANCELADA', 'RECEPCION_PROVISIONAL')).toBe(false);
  });

  it('assertCanTransitionReturn lanza InvalidReturnStateTransitionError en caso inválido', () => {
    expect(() => assertCanTransitionReturn('PROGRAMADA', 'CERRADA')).toThrow(
      InvalidReturnStateTransitionError,
    );
  });
});
