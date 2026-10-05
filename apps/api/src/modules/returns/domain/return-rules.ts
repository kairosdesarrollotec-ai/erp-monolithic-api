import { DamageOrigin, DamageSeverity, ReturnStatus } from './return-status';

export interface DamageLike {
  readonly origin: DamageOrigin;
  readonly severity: DamageSeverity;
  readonly estimatedAmount: number | null;
}

export type VehicleStatusAfterReturn = 'AVAILABLE' | 'MAINTENANCE';

/**
 * DR-DEV-001 / NFR-KAI-008: la garantía no se libera ni la devolución se cierra con incidencias abiertas.
 * Modelo físico actual (sin tabla `incidents`): una incidencia está abierta cuando
 *  - la inspección declaró daños (CON_DANOS) y aún no se evaluó ninguno, o
 *  - existe un daño TÉCNICO sin monto del informe externo de Motrix (BR-DEV-006, RSK-DEV-001).
 */
export function findOpenIncidents(status: ReturnStatus, damages: readonly DamageLike[]): string[] {
  const open: string[] = [];
  if (status === 'CON_DANOS' && damages.length === 0) {
    open.push('DANOS_SIN_EVALUAR');
  }
  const pendingTechnical = damages.filter((d) => d.origin === 'TECHNICAL' && d.estimatedAmount === null).length;
  if (pendingTechnical > 0) {
    open.push(`DANO_TECNICO_SIN_MONTO_DE_INFORME(${pendingTechnical})`);
  }
  return open;
}

/** Flota tras cerrar: todo daño técnico o grave deja la unidad en MAINTENANCE; si no, vuelve a AVAILABLE. */
export function resolveVehicleStatusAfterReturn(damages: readonly DamageLike[]): VehicleStatusAfterReturn {
  return damages.some((d) => d.origin === 'TECHNICAL' || d.severity === 'GRAVE') ? 'MAINTENANCE' : 'AVAILABLE';
}

/** BR-DEV-007: un daño grave siempre lleva al cliente a ROJO (el semáforo nunca retrocede, BR-DEV-008). */
export function requiresRedRiskStatus(severity: DamageSeverity): boolean {
  return severity === 'GRAVE';
}

export function appendNotes(existing: string | null | undefined, ...parts: Array<string | undefined>): string | undefined {
  const additions = parts.map((p) => p?.trim()).filter((p): p is string => !!p);
  if (additions.length === 0) return undefined;
  return [existing?.trim(), ...additions].filter((p): p is string => !!p).join('\n');
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** DEV-01/DEV-03: solo un alquiler en curso puede entrar a devolución (RentalNotReturnableError en otro caso). */
export function isReturnableRentalStatus(status: string): boolean {
  return status === 'ACTIVE' || status === 'RETURN_IN_PROGRESS';
}
