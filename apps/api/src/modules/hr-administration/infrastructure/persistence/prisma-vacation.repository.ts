import { Injectable } from '@nestjs/common';
import type { Prisma, VacationRequest } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateVacationData,
  VacationRepositoryPort,
  VacationWithEmployee,
} from '../../application/ports/vacation-repository.port';
import { VACATION_CAPACITY_STATUSES } from '../../domain/hr-administration-rules';

@Injectable()
export class PrismaVacationRepository implements VacationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.create({
      data: {
        employeeId: data.employeeId,
        areaId: data.areaId,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes ?? null,
        status: data.status ?? 'SOLICITADA',
        approvedById: data.approvedById ?? null,
        approvedAt: data.approvedAt ?? null,
      },
    });
  }

  async findByEmployee(employeeId: string, limit?: number, tx?: Prisma.TransactionClient): Promise<VacationRequest[]> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.findMany({
      where: { employeeId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      ...(limit ? { take: limit } : {}),
    });
  }

  async findActiveByArea(
    companyId: string,
    areaId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VacationRequest[]> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.findMany({
      where: {
        areaId,
        employee: { operatingCompanyId: companyId },
        status: { in: [...VACATION_CAPACITY_STATUSES] },
      },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async findCalendar(
    companyId: string,
    year: number,
    month?: number,
    areaId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VacationWithEmployee[]> {
    const client = tx ?? this.prisma;

    let startDate: Date;
    let endDate: Date;
    if (month !== undefined && month >= 1 && month <= 12) {
      startDate = new Date(Date.UTC(year, month - 1, 1));
      endDate = new Date(Date.UTC(year, month, 0));
    } else {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year, 11, 31));
    }

    return client.vacationRequest.findMany({
      where: {
        employee: { operatingCompanyId: companyId },
        ...(areaId ? { areaId } : {}),
        status: { in: [...VACATION_CAPACITY_STATUSES, 'COMPLETADA'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { employee: { select: { fullName: true, areaName: true } } },
      orderBy: [{ startDate: 'asc' }, { requestedAt: 'asc' }],
    });
  }
}
