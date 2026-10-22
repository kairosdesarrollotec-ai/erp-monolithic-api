import { canActorApprove, effectiveDeletionStatus } from '../../domain/evidence-deletion-rules';
import type { EvidenceDeletionRequestRecord } from '../../domain/evidence-deletion-types';

/** Solicitud con el estado EFECTIVO (una abierta vencida se ve EXPIRED) y lo que puede hacer el usuario que consulta. */
export interface EvidenceDeletionRequestView {
  request: EvidenceDeletionRequestRecord;
  viewer: { canApprove: boolean; canReject: boolean };
}

export function toDeletionView(
  request: EvidenceDeletionRequestRecord,
  viewerUid: string,
  viewerCanApprovePermission: boolean,
  now: Date,
): EvidenceDeletionRequestView {
  const status = effectiveDeletionStatus(request, now);
  const open = status === 'PENDING' || status === 'APPROVED_1';
  return {
    request: { ...request, status },
    viewer: {
      canApprove: viewerCanApprovePermission && canActorApprove(request, viewerUid, now),
      canReject: viewerCanApprovePermission && open && viewerUid !== request.requestedBy,
    },
  };
}
