/**
 * DEC-EVID-DELETE-002 (Respuestas 2026-10-20 #35, SDD-KAIROS-TRANSVERSAL 15.5) - doble aprobacion para eliminar evidencia.
 * PENDING --(1a aprobacion)--> APPROVED_1 --(2a aprobacion = ejecuta el borrado)--> EXECUTED; REJECTED / EXPIRED terminales.
 */
export const EVIDENCE_DELETION_TARGET_KINDS = ['RENTAL', 'RETURN'] as const;
export type EvidenceDeletionTargetKind = (typeof EVIDENCE_DELETION_TARGET_KINDS)[number];

export const EVIDENCE_DELETION_STATUSES = ['PENDING', 'APPROVED_1', 'EXECUTED', 'REJECTED', 'EXPIRED'] as const;
export type EvidenceDeletionStatus = (typeof EVIDENCE_DELETION_STATUSES)[number];

/** Estados en los que la solicitud sigue abierta (admite aprobar / rechazar y bloquea una solicitud nueva sobre la misma evidencia). */
export const EVIDENCE_DELETION_OPEN_STATUSES: readonly EvidenceDeletionStatus[] = ['PENDING', 'APPROVED_1'];

/** Foto fija del registro de evidencia al solicitar (el registro original desaparece al ejecutarse). */
export interface EvidenceSnapshot {
  type: string;
  zone: string;
  objectUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface EvidenceDeletionRequestRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  targetKind: EvidenceDeletionTargetKind;
  /** rentalId (RENTAL) o returnId (RETURN). */
  parentId: string;
  evidenceId: string;
  evidenceSnapshot: EvidenceSnapshot;
  reason: string;
  status: EvidenceDeletionStatus;
  requestedBy: string;
  requestedAt: Date;
  firstApprovedBy: string | null;
  firstApprovedAt: Date | null;
  firstApprovalNote: string | null;
  secondApprovedBy: string | null;
  secondApprovedAt: Date | null;
  secondApprovalNote: string | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  executedAt: Date | null;
  expiredAt: Date | null;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
