import type { ReturnStatus } from './return-status';

/**
 * BR-DEV-003 / BR-DEV-004 (CONFIRMADO por el usuario, 2026-10-15): tolerancia de devolución SIN sanción de 30 minutos
 * sobre la hora pactada. Devolver hasta 30 min tarde NO cuenta como retraso. Fuente única de la constante: el texto
 * del recordatorio (BR-DEV-004) y el cálculo de retraso (BR-DEV-003) la comparten.
 *
 * Alcance: los documentos NO definen ningún cargo por retraso ni su tarifa; por eso la tolerancia solo gobierna el
 * indicador `isLate` (informativo para el front). No dispara cobros ni bloqueos.
 */
export const RETURN_LATE_TOLERANCE_MINUTES = 30;
export const RETURN_LATE_TOLERANCE_MS = RETURN_LATE_TOLERANCE_MINUTES * 60 * 1000;

export interface LatenessSubject {
  status: ReturnStatus;
  scheduledAt: Date;
  receivedAt: Date | null;
}

export interface ReturnLateness {
  lateToleranceMinutes: number;
  /** Minutos enteros transcurridos después de la hora pactada hasta la referencia (0 si no hay retraso bruto). */
  lateMinutes: number;
  /** true solo si el retraso supera estrictamente la tolerancia. */
  isLate: boolean;
  /** RECEIVED = medido contra la recepción real (definitivo); NOW = vehículo aún no recibido (parcial, crece con el reloj). */
  basis: 'RECEIVED' | 'NOW';
}

/** Devuelve null para devoluciones CANCELADA sin recepción (no aplica). */
export function computeReturnLateness(subject: LatenessSubject, now: Date): ReturnLateness | null {
  if (!subject.receivedAt && subject.status === 'CANCELADA') return null;
  const reference = subject.receivedAt ?? now;
  const deltaMs = reference.getTime() - subject.scheduledAt.getTime();
  return {
    lateToleranceMinutes: RETURN_LATE_TOLERANCE_MINUTES,
    lateMinutes: deltaMs > 0 ? Math.floor(deltaMs / 60000) : 0,
    isLate: deltaMs > RETURN_LATE_TOLERANCE_MS,
    basis: subject.receivedAt ? 'RECEIVED' : 'NOW',
  };
}
