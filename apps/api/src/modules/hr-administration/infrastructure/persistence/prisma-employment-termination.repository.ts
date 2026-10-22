import { Injectable } from '@nestjs/common';
import type { EmploymentTermination, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateTerminationData,
  EmploymentTerminationRepositoryPort,
} from '../../application/ports/employment-termination-repository.port';

@Injectable()
export class PrismaEmploymentTerminationRepository implements EmploymentTerminationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTerminationData, tx?: Prisma.TransactionClient): Promise<EmploymentTermination> {
    const client = tx ?? this.prisma;
    return client.employmentTermination.create({
      data: {
        employeeId: data.employeeId,
        reason: data.reason,
        noticeDays: data.noticeDays ?? 0,
        finalSettlementPaid: data.finalSettlementPaid ?? false,
        settlementAmount: data.settlementAmount ?? 0,
        notes: data.notes ?? null,
        terminatedById: data.terminatedById,
        terminatedAt: data.terminatedAt,
      },
    });
  }

  async findByEmployeeId(
    employeeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<EmploymentTermination | null> {
    const client = tx ?? this.prisma;
    return client.employmentTermination.findUnique({ where: { employeeId } });
  }

  async findCreatedVacancyId(
    terminationId: string,
    candidateId?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const client = tx ?? this.prisma;
    const found = await client.vacancy.findFirst({
      where: { OR: [{ originTerminationId: terminationId }, ...(candidateId ? [{ originCandidateId: candidateId }] : [])] },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return found?.id ?? null;
  }
}
