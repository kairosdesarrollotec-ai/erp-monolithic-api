import { Injectable } from '@nestjs/common';
import type { Prisma, VacationRequest } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CancelVacationData,
  CreateVacationData,
  RescheduleVacationData,
  ResolveVacationData,
  VacationWithEmployeeScope,
  VacationRepositoryPort,
  VacationWithEmployee,
} from '../../application/ports/vacation-repository.port';
import { VACATION_CAPACITY_STATUSES } from '../../domain/hr-administration-rules';
import { VacationOverlapError } from '../../domain/hr-administration-errors';

/** La EXCLUDE de BD (empresa + area + fechas) es la red de seguridad final frente a dos reprogramaciones simultaneas. */
function isVacationOverlapConstraintError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? '');
  return message.includes('vacation_requests_area_no_overlap_excl') || message.includes('23P01');
}

@Injectable()
export class PrismaVacationRepository implements VacationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.create({
      data: {
        employeeId: data.employeeId,
        operatingCompanyId: data.operatingCompanyId,
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

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<VacationWithEmployeeScope | null> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { fullName: true, areaName: true, areaId: true, status: true, organizationId: true, operatingCompanyId: true, branchId: true },
        },
      },
    });
  }

  async reschedule(id: string, data: RescheduleVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest> {
    const client = tx ?? this.prisma;
    const current = await client.vacationRequest.findUniqueOrThrow({ where: { id } });
    try {
      return await client.vacationRequest.update({
        where: { id },
        data: {
          startDate: data.startDate,
          endDate: data.endDate,
          status: 'REPROGRAMADA',
          // Las fechas originales se guardan UNA vez (la primera reprogramacion); las siguientes conservan el origen.
          originalStartDate: current.originalStartDate ?? current.startDate,
          originalEndDate: current.originalEndDate ?? current.endDate,
          rescheduleCount: { increment: 1 },
          statusReason: data.reason,
          statusChangedAt: data.changedAt,
          statusChangedById: data.changedById,
        },
      });
    } catch (error) {
      if (isVacationOverlapConstraintError(error)) {
        throw new VacationOverlapError('del colaborador');
      }
      throw error;
    }
  }

  async cancel(id: string, data: CancelVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        statusReason: data.reason,
        statusChangedAt: data.changedAt,
        statusChangedById: data.changedById,
      },
    });
  }

  async resolve(id: string, data: ResolveVacationData, tx?: Prisma.TransactionClient): Promise<VacationRequest> {
    const client = tx ?? this.prisma;
    try {
      return await client.vacationRequest.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.grantedDays !== undefined ? { grantedDays: data.grantedDays } : {}),
          ...(data.endDate ? { endDate: data.endDate } : {}),
          ...(data.statusReason !== undefined ? { statusReason: data.statusReason } : {}),
          ...(data.approvedById !== undefined ? { approvedById: data.approvedById } : {}),
          ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
          ...(data.statusChangedById !== undefined ? { statusChangedById: data.statusChangedById } : {}),
          ...(data.statusChangedAt !== undefined ? { statusChangedAt: data.statusChangedAt } : {}),
        },
      });
    } catch (error) {
      if (isVacationOverlapConstraintError(error)) {
        throw new VacationOverlapError('del colaborador');
      }
      throw error;
    }
  }

  async findActiveByCompany(companyId: string, tx?: Prisma.TransactionClient): Promise<VacationRequest[]> {
    const client = tx ?? this.prisma;
    return client.vacationRequest.findMany({
      where: { operatingCompanyId: companyId, status: { in: [...VACATION_CAPACITY_STATUSES] } },
      orderBy: { requestedAt: 'asc' },
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
        operatingCompanyId: companyId,
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
