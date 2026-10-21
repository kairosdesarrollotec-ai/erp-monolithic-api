import type { Prisma } from '@prisma/client';
import type {
  EvidenceDeletionRequestRecord,
  EvidenceDeletionStatus,
  EvidenceDeletionTargetKind,
  EvidenceSnapshot,
} from '../../domain/evidence-deletion-types';

export interface EvidenceDeletionScope {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

export interface CreateEvidenceDeletionRequestData extends EvidenceDeletionScope {
  targetKind: EvidenceDeletionTargetKind;
  parentId: string;
  evidenceId: string;
  evidenceSnapshot: EvidenceSnapshot;
  reason: string;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
}

/** Campos que una transicion puede escribir (el repositorio suma `version + 1` y `updatedAt`). */
export type EvidenceDeletionPatch = Partial<
  Pick<
    EvidenceDeletionRequestRecord,
    | 'status'
    | 'firstApprovedBy'
    | 'firstApprovedAt'
    | 'firstApprovalNote'
    | 'secondApprovedBy'
    | 'secondApprovedAt'
    | 'secondApprovalNote'
    | 'rejectedBy'
    | 'rejectedAt'
    | 'rejectionReason'
    | 'executedAt'
    | 'expiredAt'
  >
>;

export interface ListEvidenceDeletionFilter {
  organizationId: string;
  operatingCompanyId: string;
  /** Estado EFECTIVO: EXPIRED incluye las abiertas ya vencidas; PENDING/APPROVED_1 solo las vigentes. */
  status?: EvidenceDeletionStatus;
  targetKind?: EvidenceDeletionTargetKind;
  now: Date;
  limit: number;
}

/**
 * DEC-EVID-DELETE-002 - persistencia de solicitudes de eliminacion de evidencia. Las transiciones son atomicas y con guarda
 * (estado + version): dos aprobadores simultaneos no pueden saltarse la doble aprobacion.
 */
export abstract class EvidenceDeletionRequestRepositoryPort {
  /** Lanza EvidenceDeletionAlreadyRequestedError si ya hay una solicitud abierta para esa evidencia (indice unico parcial). */
  abstract create(data: CreateEvidenceDeletionRequestData, tx?: Prisma.TransactionClient): Promise<EvidenceDeletionRequestRecord>;

  abstract findById(
    id: string,
    organizationId: string,
    operatingCompanyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceDeletionRequestRecord | null>;

  abstract findOpenByEvidence(
    targetKind: EvidenceDeletionTargetKind,
    evidenceId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceDeletionRequestRecord | null>;

  abstract list(filter: ListEvidenceDeletionFilter): Promise<EvidenceDeletionRequestRecord[]>;

  /** UPDATE ... WHERE id AND version AND status IN expected; null si la solicitud ya cambio (otro actor llego primero). */
  abstract transition(
    id: string,
    expected: { statuses: readonly EvidenceDeletionStatus[]; version: number },
    patch: EvidenceDeletionPatch,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceDeletionRequestRecord | null>;

  /** Abiertas con vigencia vencida, de cualquier organizacion (proceso del sistema). */
  abstract findDueOpen(now: Date, limit: number): Promise<EvidenceDeletionRequestRecord[]>;
}
