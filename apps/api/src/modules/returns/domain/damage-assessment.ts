import { DamageOrigin, DamageSeverity } from './return-status';
import { getCosmeticDamageRate, normalizeZoneCode } from './cosmetic-damage-rate';
import {
  InvalidAestheticDamageError,
  TechnicalDamageRequiresExternalReportError,
  UnknownCosmeticZoneError,
} from './return-errors';

export interface DamageAssessmentInput {
  origin: DamageOrigin;
  severity: DamageSeverity;
  damagedZone?: string;
  estimatedAmount?: number;
  externalReportReference?: string;
  description?: string;
}

export interface ResolvedDamageAssessment {
  origin: DamageOrigin;
  severity: DamageSeverity;
  damagedZone: string | null;
  estimatedAmount: number | null;
  externalReportReference: string | null;
  description: string | null;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * BR-DEV-006 (confirmada 31 ago 2026) / DR-DEV-002:
 *  - AESTHETIC: el monto sale SIEMPRE del tarifario fijo por paño; cualquier monto enviado por el cliente se ignora
 *    y no admite referencia a informe externo.
 *  - TECHNICAL: nunca se calcula; exige la referencia del informe externo (Motrix) y registra el monto manual
 *    informado (puede quedar pendiente -> incidencia abierta, DR-DEV-001).
 */
export function resolveDamageAssessment(input: DamageAssessmentInput): ResolvedDamageAssessment {
  const externalReportReference = blankToNull(input.externalReportReference);

  if (input.origin === 'TECHNICAL') {
    if (!externalReportReference) {
      throw new TechnicalDamageRequiresExternalReportError();
    }
    return {
      origin: 'TECHNICAL',
      severity: input.severity,
      damagedZone: blankToNull(input.damagedZone),
      estimatedAmount: input.estimatedAmount ?? null,
      externalReportReference,
      description: blankToNull(input.description),
    };
  }

  if (externalReportReference) {
    throw new InvalidAestheticDamageError();
  }
  const zone = blankToNull(input.damagedZone);
  const rate = zone ? getCosmeticDamageRate(zone) : null;
  if (!zone || rate === null) {
    throw new UnknownCosmeticZoneError(zone ?? '(sin zona)');
  }
  return {
    origin: 'AESTHETIC',
    severity: input.severity,
    damagedZone: normalizeZoneCode(zone),
    estimatedAmount: rate,
    externalReportReference: null,
    description: blankToNull(input.description),
  };
}
