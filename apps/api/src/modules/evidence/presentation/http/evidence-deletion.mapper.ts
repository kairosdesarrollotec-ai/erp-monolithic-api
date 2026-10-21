import type { EvidenceDeletionRequestView } from '../../application/queries/evidence-deletion-view';
import type { EvidenceDeletionRequestResponse } from './dto/evidence-deletion.response';

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function toEvidenceDeletionResponse(view: EvidenceDeletionRequestView): EvidenceDeletionRequestResponse {
  const r = view.request;
  return {
    id: r.id,
    companyId: r.operatingCompanyId,
    branchId: r.branchId,
    targetKind: r.targetKind,
    targetId: r.parentId,
    evidenceId: r.evidenceId,
    // El objectUrl del archivo NO se expone aqui: la foto fija completa vive en la base y en la auditoria.
    evidence: { type: r.evidenceSnapshot.type, zone: r.evidenceSnapshot.zone, uploadedBy: r.evidenceSnapshot.uploadedBy, uploadedAt: r.evidenceSnapshot.uploadedAt },
    reason: r.reason,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt.toISOString(),
    firstApprovedBy: r.firstApprovedBy,
    firstApprovedAt: iso(r.firstApprovedAt),
    firstApprovalNote: r.firstApprovalNote,
    secondApprovedBy: r.secondApprovedBy,
    secondApprovedAt: iso(r.secondApprovedAt),
    secondApprovalNote: r.secondApprovalNote,
    rejectedBy: r.rejectedBy,
    rejectedAt: iso(r.rejectedAt),
    rejectionReason: r.rejectionReason,
    executedAt: iso(r.executedAt),
    expiredAt: iso(r.expiredAt),
    expiresAt: r.expiresAt.toISOString(),
    version: r.version,
    viewer: view.viewer,
  };
}
