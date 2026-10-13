import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateTrainingData,
  TrainingRepositoryPort,
  TrainingWithAttendees,
} from '../../application/ports/training-repository.port';

const INCLUDE_ATTENDEES = {
  attendees: { select: { employeeId: true, employee: { select: { fullName: true } } } },
} as const;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class PrismaTrainingRepository implements TrainingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTrainingData, tx?: Prisma.TransactionClient): Promise<TrainingWithAttendees> {
    const client = tx ?? this.prisma;
    return client.trainingSession.create({
      data: {
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        branchId: data.branchId,
        topic: data.topic,
        heldOn: data.heldOn,
        durationMinutes: data.durationMinutes,
        comprehensionNotes: data.comprehensionNotes ?? null,
        createdById: data.createdById,
        attendees: { create: data.attendeeIds.map((employeeId) => ({ employeeId })) },
      },
      include: INCLUDE_ATTENDEES,
    });
  }

  async findMany(
    filters: { companyId: string; branchId?: string; limit?: number },
    tx?: Prisma.TransactionClient,
  ): Promise<TrainingWithAttendees[]> {
    const client = tx ?? this.prisma;
    return client.trainingSession.findMany({
      where: {
        operatingCompanyId: filters.companyId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
      include: INCLUDE_ATTENDEES,
      orderBy: [{ heldOn: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    });
  }

  async findByEmployee(
    employeeId: string,
    limit?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<TrainingWithAttendees[]> {
    const client = tx ?? this.prisma;
    return client.trainingSession.findMany({
      where: { attendees: { some: { employeeId } } },
      include: INCLUDE_ATTENDEES,
      orderBy: [{ heldOn: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    });
  }
}
