import { NotaryResult } from '../../domain/notary-result';

export const PROHIBITED_NOTARY_EXEMPTION_MODELS = [
  'HILUX',
  'COLORADO',
  'VERNA',
  'YARIS',
] as const;

export interface EvaluateNotaryInput {
  vehicleModel: string;
  /** Alquileres previos CERRADOS del cliente con la empresa (calculado en servidor). "Cliente antiguo" = MAS de 2. */
  previousRentalsCount: number;
  /** Casilla que registra el personal (RENIEC/MTC fuera del MVP, DEC-MVP-RENIEC-MTC-EXCL). */
  biometricVerified: boolean;
  /** Marca de Flota (solo Gerencia): vehiculo "de menor costo relativo" elegible para la tercera via. */
  thirdPathEligible: boolean;
  scoreRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface NotaryEvaluationOutput {
  result: NotaryResult;
  policyVersion: number;
  reason: string;
  requiresApproval: boolean;
  approverRole?: string;
  /** Tercera via: se firma el documento de responsabilidad y NO se duplica la garantia (BR-ALQ-004). */
  requiresResponsibilityDocument?: boolean;
}

/** v2 (22-oct-2026): agrega la marca de vehiculo elegible y hace alcanzables THIRD_PATH_ELIGIBLE y MANUAL_REVIEW. */
export const NOTARY_POLICY_VERSION = 2;

/** BR-ALQ-004: cliente antiguo = MAS de 2 alquileres previos con la empresa. */
export const OLD_CUSTOMER_MIN_PREVIOUS_RENTALS = 3;

/**
 * BR-ALQ-003 y BR-ALQ-004 - Matriz de Decision Notarial (BDD-ALQ-001 10.1, SC-ALQ-002.01..04).
 * TDD-03-alquiler.md seccion 10.1 / SDD seccion 11.1
 *
 * | Vehiculo prohibido | Cliente antiguo (>2) | Biometrico OK | Vehiculo menor costo | Resultado            |
 * | Si                 | -                    | -             | -                    | MANDATORY            |
 * | No                 | No                   | -             | -                    | DOUBLE_DEPOSIT       |
 * | No                 | Si                   | Si            | Si                   | THIRD_PATH_ELIGIBLE  |
 * | No                 | Si                   | Si            | No                   | DOUBLE_DEPOSIT       |
 * | No                 | Si                   | No            | -                    | MANUAL_REVIEW        |
 *
 * Las filas "Parcial/No" de la matriz se leen asi: un cliente antiguo con el biometrico no verificado no es un caso
 * automatico y se deriva a revision manual (Gerencia). THIRD_PATH_ELIGIBLE y MANUAL_REVIEW requieren aprobacion de
 * Gerencia (approve-notary-exception); DOUBLE_DEPOSIT y MANDATORY avanzan solos.
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

  // 2. Cliente nuevo (<= 2 alquileres previos): doble garantia (bajo consulta).
  if (input.previousRentalsCount < OLD_CUSTOMER_MIN_PREVIOUS_RENTALS) {
    return {
      result: 'DOUBLE_DEPOSIT',
      policyVersion: NOTARY_POLICY_VERSION,
      reason: 'Cliente con 2 o menos alquileres previos; aplica doble depósito de garantía (SC-ALQ-002.02).',
      requiresApproval: false,
    };
  }

  // 3. Cliente antiguo (> 2 alquileres previos) sin biometrico verificado: revision manual por Gerencia.
  if (!input.biometricVerified) {
    return {
      result: 'MANUAL_REVIEW',
      policyVersion: NOTARY_POLICY_VERSION,
      reason: 'Cliente antiguo sin verificación biométrica registrada; la matriz no es determinista y se deriva a revisión manual de Gerencia.',
      requiresApproval: true,
      approverRole: 'GERENCIA',
    };
  }

  // 4. Cliente antiguo con biometrico favorable.
  if (input.thirdPathEligible) {
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
      reason:
        'Cliente antiguo con biometría favorable y vehículo de menor costo; elegible para la tercera vía (documento de responsabilidad, sin garantía duplicada) bajo aprobación de Gerencia (BR-ALQ-004).',
      requiresApproval: true,
      approverRole: 'GERENCIA',
      requiresResponsibilityDocument: true,
    };
  }

  // 5. Cliente antiguo con biometrico favorable pero vehiculo que no es de menor costo: no hay tercera via (SC-ALQ-002.04).
  return {
    result: 'DOUBLE_DEPOSIT',
    policyVersion: NOTARY_POLICY_VERSION,
    reason: 'Cliente antiguo con biometría favorable pero el vehículo no es de menor costo relativo; no aplica la tercera vía, aplica doble depósito (SC-ALQ-002.04).',
    requiresApproval: false,
  };
}
