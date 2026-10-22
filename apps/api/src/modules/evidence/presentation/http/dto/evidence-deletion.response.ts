import type { EvidenceDeletionStatus, EvidenceDeletionTargetKind } from '../../../domain/evidence-deletion-types';

export interface EvidenceDeletionEvidenceResponse {
  type: string;
  zone: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface EvidenceDeletionRequestResponse {
  id: string;
  companyId: string;
  branchId: string;
  targetKind: EvidenceDeletionTargetKind;
  targetId: string;
  evidenceId: string;
  evidence: EvidenceDeletionEvidenceResponse;
  reason: string;
  /** Estado efectivo: una solicitud abierta cuya vigencia paso se informa EXPIRED. */
  status: EvidenceDeletionStatus;
  requestedBy: string;
  requestedAt: string;
  firstApprovedBy: string | null;
  firstApprovedAt: string | null;
  firstApprovalNote: string | null;
  secondApprovedBy: string | null;
  secondApprovedAt: string | null;
  secondApprovalNote: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  executedAt: string | null;
  expiredAt: string | null;
  expiresAt: string;
  version: number;
  /** Lo que puede hacer el usuario que consulta (para pintar los botones); la autoridad sigue siendo el backend. */
  viewer: { canApprove: boolean; canReject: boolean };
}
