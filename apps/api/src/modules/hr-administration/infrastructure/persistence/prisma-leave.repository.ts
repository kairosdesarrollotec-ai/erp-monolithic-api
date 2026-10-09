import { Injectable } from '@nestjs/common';
import type { LeaveRequest, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateLeaveData,
  LeaveRepositoryPort,
  LeaveWithEmployee,
  ResolveLeaveData,
} from '../../application/ports/leave-repository.port';
import { LeaveAlreadyResolvedError } from '../../domain/hr-administration-errors';

@Injectable()
export class PrismaLeaveRepository implements LeaveRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLeaveData, tx?: Prisma.TransactionClient): Promise<LeaveRequest> {
    const client = tx ?? this.prisma;
    return client.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        type: data.type,
        date: data.date,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        reason: data.reason,
        status: 'SOLICITADO',
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<LeaveWithEmployee | null> {
    const client = tx ?? this.prisma;
    return client.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, organizationId: true, operatingCompanyId: true, branchId: true } },
      },
    });
  }

  async findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<LeaveRequest[]> {
    const client = tx ?? this.prisma;
    return client.leaveRequest.findMany({
      where: { employeeId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      ...(limit ? { take: limit } : {}),
    });
  }

  async resolve(id: string, data: ResolveLeaveData, tx?: Prisma.TransactionClient): Promise<LeaveRequest> {
    const client = tx ?? this.prisma;
    const result = await client.leaveRequest.updateMany({
      where: { id, status: 'SOLICITADO' },
      data: {
        status: data.status,
        authorizedById: data.authorizedById,
        authorizedByName: data.authorizedByName ?? null,
        resolutionNotes: data.resolutionNotes ?? null,
        resolvedAt: data.resolvedAt,
      },
    });
    if (result.count === 0) {
      throw new LeaveAlreadyResolvedError(id);
    }
    return client.leaveRequest.findUniqueOrThrow({ where: { id } });
  }
}
