import { Prisma } from '@prisma/client';
import { PrismaEvidenceDeletionRequestRepository } from './prisma-evidence-deletion-request.repository';
import { EvidenceDeletionAlreadyRequestedError } from '../../domain/evidence-deletion-errors';

const NOW = new Date('2026-10-21T15:00:00Z');

function build() {
  const prisma = {
    evidenceDeletionRequest: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, repo: new PrismaEvidenceDeletionRequestRepository(prisma as never) };
}

describe('PrismaEvidenceDeletionRequestRepository', () => {
  it('create traduce la violacion del indice unico parcial a EVIDENCE_DELETION_ALREADY_REQUESTED', async () => {
    const { prisma, repo } = build();
    prisma.evidenceDeletionRequest.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(
      repo.create({
        organizationId: 'o', operatingCompanyId: 'c', branchId: 'b', targetKind: 'RENTAL', parentId: 'p', evidenceId: 'e',
        evidenceSnapshot: { type: 'PHOTO', zone: 'Z', objectUrl: 'u', uploadedBy: 'x', uploadedAt: NOW.toISOString() },
        reason: 'motivo', requestedBy: 'u', requestedAt: NOW, expiresAt: NOW,
      }),
    ).rejects.toBeInstanceOf(EvidenceDeletionAlreadyRequestedError);
  });

  it('transition: UPDATE condicionado por id + version + estados esperados, suma version; null si perdio la carrera', async () => {
    const { prisma, repo } = build();
    prisma.evidenceDeletionRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await repo.transition('r1', { statuses: ['PENDING'], version: 3 }, { status: 'APPROVED_1' })).toBeNull();
    expect(prisma.evidenceDeletionRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', version: 3, status: { in: ['PENDING'] } },
      data: expect.objectContaining({ status: 'APPROVED_1', version: { increment: 1 } }),
    });
    expect(prisma.evidenceDeletionRequest.findUnique).not.toHaveBeenCalled();
  });

  it('list: EXPIRED incluye las abiertas vencidas; PENDING/APPROVED_1 solo las vigentes', async () => {
    const { prisma, repo } = build();
    const base = { organizationId: 'o', operatingCompanyId: 'c', now: NOW, limit: 10 };
    await repo.list({ ...base, status: 'EXPIRED' });
    expect(prisma.evidenceDeletionRequest.findMany.mock.calls[0][0].where.OR).toEqual([
      { status: 'EXPIRED' },
      { status: { in: ['PENDING', 'APPROVED_1'] }, expiresAt: { lte: NOW } },
    ]);
    await repo.list({ ...base, status: 'PENDING', targetKind: 'RETURN' });
    expect(prisma.evidenceDeletionRequest.findMany.mock.calls[1][0].where).toEqual({
      organizationId: 'o', operatingCompanyId: 'c', targetKind: 'RETURN', status: 'PENDING', expiresAt: { gt: NOW },
    });
  });
});
