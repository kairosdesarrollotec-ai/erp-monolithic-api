import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateEvidenceDeletionRequestData,
  EvidenceDeletionPatch,
  EvidenceDeletionRequestRepositoryPort,
  ListEvidenceDeletionFilter,
} from '../../application/ports/evidence-deletion-request-repository.port';
import { EvidenceDeletionAlreadyRequestedError } from '../../domain/evidence-deletion-errors';
import {
  EVIDENCE_DELETION_OPEN_STATUSES,
  type EvidenceDeletionRequestRecord,
  type EvidenceDeletionStatus,
  type EvidenceDeletionTargetKind,
  type EvidenceSnapshot,
} from '../../domain/evidence-deletion-types';

type Row = Prisma.EvidenceDeletionRequestGetPayload<Record<string, never>>;
type Client = Prisma.TransactionClient | PrismaService;

export function toEvidenceDeletionRecord(row: Row): EvidenceDeletionRequestRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    targetKind: row.targetKind as EvidenceDeletionTargetKind,
    parentId: row.parentId,
    evidenceId: row.evidenceId,
    evidenceSnapshot: row.evidenceSnapshot as unknown as EvidenceSnapshot,
    reason: row.reason,
    status: row.status as EvidenceDeletionStatus,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    firstApprovedBy: row.firstApprovedBy,
    firstApprovedAt: row.firstApprovedAt,
    firstApprovalNote: row.firstApprovalNote,
    secondApprovedBy: row.secondApprovedBy,
    secondApprovedAt: row.secondApprovedAt,
    secondApprovalNote: row.secondApprovalNote,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
    executedAt: row.executedAt,
    expiredAt: row.expiredAt,
    expiresAt: row.expiresAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaEvidenceDeletionRequestRepository extends EvidenceDeletionRequestRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateEvidenceDeletionRequestData, tx?: Prisma.TransactionClient): Promise<EvidenceDeletionRequestRecord> {
    const client: Client = tx ?? this.prisma;
    try {
      const row = await client.evidenceDeletionRequest.create({
        data: {
          organizationId: data.organizationId,
          operatingCompanyId: data.operatingCompanyId,
          branchId: data.branchId,
          targetKind: data.targetKind,
          parentId: data.parentId,
          evidenceId: data.evidenceId,
          evidenceSnapshot: data.evidenceSnapshot as unknown as Prisma.InputJsonValue,
          reason: data.reason,
          requestedBy: data.requestedBy,
          requestedAt: data.requestedAt,
          expiresAt: data.expiresAt,
        },
      });
      return toEvidenceDeletionRecord(row);
    } catch (error) {
      // Indice unico parcial uq_evidence_deletion_open_evidence: dos solicitudes simultaneas sobre la misma evidencia.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EvidenceDeletionAlreadyRequestedError();
      }
      throw error;
    }
  }

  async findById(id: string, organizationId: string, operatingCompanyId: string, tx?: Prisma.TransactionClient): Promise<EvidenceDeletionRequestRecord | null> {
    const client: Client = tx ?? this.prisma;
    const row = await client.evidenceDeletionRequest.findFirst({ where: { id, organizationId, operatingCompanyId } });
    return row ? toEvidenceDeletionRecord(row) : null;
  }

  async findOpenByEvidence(
    targetKind: EvidenceDeletionTargetKind,
    evidenceId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceDeletionRequestRecord | null> {
    const client: Client = tx ?? this.prisma;
    const row = await client.evidenceDeletionRequest.findFirst({
      where: { targetKind, evidenceId, organizationId, status: { in: [...EVIDENCE_DELETION_OPEN_STATUSES] } },
    });
    return row ? toEvidenceDeletionRecord(row) : null;
  }

  async list(filter: ListEvidenceDeletionFilter): Promise<EvidenceDeletionRequestRecord[]> {
    const open = [...EVIDENCE_DELETION_OPEN_STATUSES];
    const where: Prisma.EvidenceDeletionRequestWhereInput = {
      organizationId: filter.organizationId,
      operatingCompanyId: filter.operatingCompanyId,
      ...(filter.targetKind ? { targetKind: filter.targetKind } : {}),
    };
    if (filter.status === 'EXPIRED') {
      // Efectivo: marcadas EXPIRED + abiertas cuya vigencia ya paso (el job aun no las marco).
      where.OR = [{ status: 'EXPIRED' }, { status: { in: open }, expiresAt: { lte: filter.now } }];
    } else if (filter.status === 'PENDING' || filter.status === 'APPROVED_1') {
      where.status = filter.status;
      where.expiresAt = { gt: filter.now };
    } else if (filter.status) {
      where.status = filter.status;
    }
    const rows = await this.prisma.evidenceDeletionRequest.findMany({
      where,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
    });
    return rows.map(toEvidenceDeletionRecord);
  }

  async transition(
    id: string,
    expected: { statuses: readonly EvidenceDeletionStatus[]; version: number },
    patch: EvidenceDeletionPatch,
    tx?: Prisma.TransactionClient,
  ): Promise<EvidenceDeletionRequestRecord | null> {
    const client: Client = tx ?? this.prisma;
    const result = await client.evidenceDeletionRequest.updateMany({
      where: { id, version: expected.version, status: { in: [...expected.statuses] } },
      data: { ...patch, version: { increment: 1 }, updatedAt: new Date() },
    });
    if (result.count === 0) return null;
    const row = await client.evidenceDeletionRequest.findUnique({ where: { id } });
    return row ? toEvidenceDeletionRecord(row) : null;
  }

  async findDueOpen(now: Date, limit: number): Promise<EvidenceDeletionRequestRecord[]> {
    const rows = await this.prisma.evidenceDeletionRequest.findMany({
      where: { status: { in: [...EVIDENCE_DELETION_OPEN_STATUSES] }, expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
    return rows.map(toEvidenceDeletionRecord);
  }
}
