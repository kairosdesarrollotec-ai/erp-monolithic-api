import { NotaryResult } from '../../domain/notary-result';

export const PROHIBITED_NOTARY_EXEMPTION_MODELS = [
  'HILUX',
  'COLORADO',
  'VERNA',
  'YARIS',
] as const;

export interface EvaluateNotaryInput {
  vehicleModel: string;
  previousRentalsCount: number;
  biometricVerified: boolean;
  scoreRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface NotaryEvaluationOutput {
  result: NotaryResult;
  policyVersion: number;
  reason: string;
  requiresApproval: boolean;
  approverRole?: string;
}

export const NOTARY_POLICY_VERSION = 1;

/**
 * BR-ALQ-003 y BR-ALQ-004 - Matriz de Decision Notarial.
 * TDD-03-alquiler.md seccion 10.1 / SDD seccion 11.1
 */
export function evaluateNotaryMatrix(input: EvaluateNotaryInput): NotaryEvaluationOutput {
  const normalizedModel = (input.vehicleModel || '').trim().toUpperCase();

  // 1. Regla dura: Vehículos de alto riesgo / siniestralidad no admiten excepción bajo ninguna circunstancia
  const isProhibited = PROHIBITED_NOTARY_EXEMPTION_MODELS.some((m) =>
    normalizedModel.includes(m),
  );

  if (isProhibited) {
    return {
      result: 'MANDATORY',
      policyVersion: NOTARY_POLICY_VERSION,
      reason: `Vehículo modelo ${input.vehicleModel} está en lista de alto riesgo (BR-ALQ-003); notaría obligatoria sin excepción.`,
      requiresApproval: false,
    };
  }

  // 2. Cliente recurrente (> 2 alquileres previos concluidos) y biometría validada
  if (input.previousRentalsCount > 2 && input.biometricVerified) {
    if (input.scoreRiskLevel === 'HIGH') {
      return {
        result: 'MANDATORY',
        policyVersion: NOTARY_POLICY_VERSION,
        reason: 'Cliente recurrente pero con evaluación de riesgo alta; requiere trámite notarial.',
        requiresApproval: false,
      };
    }

    return {
      result: 'THIRD_PATH_ELIGIBLE',
      policyVersion: NOTARY_POLICY_VERSION,
      reason: 'Cliente recurrente con biometría verificada; elegible para tercer camino bajo aprobación gerencial (BR-ALQ-004).',
      requiresApproval: true,
      approverRole: 'GERENCIA',
    };
  }

  // 3. Cliente sin historial suficiente o sin biometría
  if (!input.biometricVerified || input.previousRentalsCount <= 2) {
    return {
      result: 'DOUBLE_DEPOSIT',
      policyVersion: NOTARY_POLICY_VERSION,
      reason: 'Cliente nuevo o sin validación biométrica completa; aplica doble depósito de garantía.',
      requiresApproval: false,
    };
  }

  // 4. Casos residuales / revisión manual
  return {
    result: 'MANUAL_REVIEW',
    policyVersion: NOTARY_POLICY_VERSION,
    reason: 'Condiciones no deterministas en matriz automática; derivado a revisión manual.',
    requiresApproval: true,
    approverRole: 'GERENCIA',
  };
}
