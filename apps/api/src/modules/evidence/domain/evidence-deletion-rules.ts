import {
  EvidenceDeletionInvalidStateError,
  EvidenceDeletionReasonRequiredError,
  EvidenceDeletionSameApproverError,
  EvidenceDeletionSelfApprovalError,
  EVIDENCE_DELETION_MIN_REASON_LENGTH,
} from './evidence-deletion-errors';
import {
  EVIDENCE_DELETION_OPEN_STATUSES,
  type EvidenceDeletionRequestRecord,
  type EvidenceDeletionStatus,
} from './evidence-deletion-types';

export const DEFAULT_EVIDENCE_DELETION_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias de vigencia de una solicitud (EVIDENCE_DELETION_TTL_DAYS; invalido o <= 0 -> 7). */
export function evidenceDeletionTtlDays(raw: string | undefined = process.env.EVIDENCE_DELETION_TTL_DAYS): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EVIDENCE_DELETION_TTL_DAYS;
}

export function computeEvidenceDeletionExpiry(from: Date, ttlDays: number = evidenceDeletionTtlDays()): Date {
  return new Date(from.getTime() + ttlDays * DAY_MS);
}

/** Motivo obligatorio: se recorta y exige longitud minima. */
export function normalizeDeletionReason(reason: string | null | undefined, what?: string): string {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < EVIDENCE_DELETION_MIN_REASON_LENGTH) throw new EvidenceDeletionReasonRequiredError(what);
  return trimmed;
}

/** Estado EFECTIVO: una solicitud abierta cuya vigencia ya paso se comporta (y se muestra) como EXPIRED aunque el job aun no la marque. */
export function effectiveDeletionStatus(
  request: Pick<EvidenceDeletionRequestRecord, 'status' | 'expiresAt'>,
  now: Date,
): EvidenceDeletionStatus {
  return EVIDENCE_DELETION_OPEN_STATUSES.includes(request.status) && request.expiresAt.getTime() <= now.getTime()
    ? 'EXPIRED'
    : request.status;
}

export type DeletionApprovalStep = 'FIRST' | 'SECOND';

/**
 * Reglas de separacion de funciones (SDD 15.5 / DEC-EVID-DELETE-002):
 *  - solo se aprueba una solicitud PENDING (1a aprobacion) o APPROVED_1 (2a, que ejecuta);
 *  - el solicitante NUNCA aprueba;
 *  - el segundo aprobador es distinto del solicitante Y del primero.
 * Devuelve el paso que corresponde; lanza el error de dominio si no se puede aprobar.
 */
export function assertCanApprove(
  request: Pick<EvidenceDeletionRequestRecord, 'status' | 'requestedBy' | 'firstApprovedBy'>,
  actorUserId: string,
): DeletionApprovalStep {
  if (request.status !== 'PENDING' && request.status !== 'APPROVED_1') {
    throw new EvidenceDeletionInvalidStateError(request.status);
  }
  if (actorUserId === request.requestedBy) throw new EvidenceDeletionSelfApprovalError('approve');
  if (request.status === 'APPROVED_1' && actorUserId === request.firstApprovedBy) throw new EvidenceDeletionSameApproverError();
  return request.status === 'PENDING' ? 'FIRST' : 'SECOND';
}

/** Rechazar: solicitud abierta y quien rechaza no es el solicitante. */
export function assertCanReject(
  request: Pick<EvidenceDeletionRequestRecord, 'status' | 'requestedBy'>,
  actorUserId: string,
): void {
  if (request.status !== 'PENDING' && request.status !== 'APPROVED_1') {
    throw new EvidenceDeletionInvalidStateError(request.status);
  }
  if (actorUserId === request.requestedBy) throw new EvidenceDeletionSelfApprovalError('reject');
}

/** Para la UI: ¿este usuario podria aprobar ahora mismo (ignorando el permiso de matriz)? */
export function canActorApprove(
  request: Pick<EvidenceDeletionRequestRecord, 'status' | 'requestedBy' | 'firstApprovedBy' | 'expiresAt'>,
  actorUserId: string,
  now: Date,
): boolean {
  if (effectiveDeletionStatus(request, now) !== request.status) return false;
  try {
    assertCanApprove(request, actorUserId);
    return true;
  } catch {
    return false;
  }
}
