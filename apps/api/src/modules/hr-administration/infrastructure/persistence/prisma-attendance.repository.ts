import { Injectable } from '@nestjs/common';
import type { AttendanceRecord, AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AttendanceRepositoryPort,
  AttendanceWithEmployee,
  CreateAttendanceData,
  EmployeeAttendanceTotals,
  ListAttendanceFilters,
  MonthlyAttendanceItem,
  PendingDeductionItem,
  ReclassifyAttendanceData,
} from '../../application/ports/attendance-repository.port';

function monthRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  return {
    start: new Date(Date.UTC(year, monthNum - 1, 1)),
    end: new Date(Date.UTC(year, monthNum, 0)),
  };
}

/** Registros que participan de la liquidación de fin de mes (BR-ADP-001). */
const DEDUCTIBLE_WHERE: Prisma.AttendanceRecordWhereInput = {
  OR: [{ status: 'FALTA_INJUSTIFICADA' }, { status: 'TARDANZA' }, { deductionAmount: { gt: 0 } }],
};

@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAttendanceData, tx?: Prisma.TransactionClient): Promise<AttendanceRecord> {
    const client = tx ?? this.prisma;
    return client.attendanceRecord.create({
      data: {
        employeeId: data.employeeId,
        date: data.date,
        checkInTime: data.checkInTime ?? null,
        checkOutTime: data.checkOutTime ?? null,
        status: data.status,
        minutesLate: data.minutesLate ?? 0,
        deductionAmount: data.deductionAmount ?? 0,
        notes: data.notes ?? null,
        createdById: data.createdById,
        ...(data.evidence
          ? {
              evidenceKind: data.evidence.kind,
              evidenceStorageRef: data.evidence.storageRef,
              evidenceUrl: data.evidence.url,
              evidenceCapturedAt: data.evidence.capturedAt,
              evidenceNote: data.evidence.note,
              evidenceCorroboratedById: data.evidence.corroboratedById,
              evidenceCorroboratedAt: data.evidence.corroboratedAt,
            }
          : {}),
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<AttendanceWithEmployee | null> {
    const client = tx ?? this.prisma;
    return client.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: { fullName: true, organizationId: true, operatingCompanyId: true, branchId: true, baseSalary: true },
        },
      },
    });
  }

  async reclassify(
    id: string,
    data: ReclassifyAttendanceData,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord | null> {
    const client = tx ?? this.prisma;
    const result = await client.attendanceRecord.updateMany({
      where: { id, isDeductionApplied: false, status: { in: ['FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA'] } },
      data: {
        status: data.status,
        deductionAmount: data.deductionAmount,
        justification: data.justification,
        reclassifiedById: data.reclassifiedById,
        reclassifiedAt: data.reclassifiedAt,
      },
    });
    if (result.count === 0) return null;
    return client.attendanceRecord.findUniqueOrThrow({ where: { id } });
  }

  async countInMonthOf(
    employeeId: string,
    status: AttendanceStatus,
    anyDateInMonth: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const month = `${anyDateInMonth.getUTCFullYear()}-${String(anyDateInMonth.getUTCMonth() + 1).padStart(2, '0')}`;
    const { start, end } = monthRange(month);
    return client.attendanceRecord.count({ where: { employeeId, status, date: { gte: start, lte: end } } });
  }

  async findByEmployeeAndDate(
    employeeId: string,
    date: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord | null> {
    const client = tx ?? this.prisma;
    return client.attendanceRecord.findFirst({ where: { employeeId, date } });
  }

  async findManyByEmployee(
    employeeId: string,
    filters?: ListAttendanceFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<AttendanceRecord[]> {
    const client = tx ?? this.prisma;
    const where: Prisma.AttendanceRecordWhereInput = { employeeId };

    if (filters?.startDate || filters?.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    } else if (filters?.month) {
      const { start, end } = monthRange(filters.month);
      where.date = { gte: start, lte: end };
    }

    return client.attendanceRecord.findMany({ where, orderBy: { date: 'desc' } });
  }

  async totalsByEmployee(employeeId: string, tx?: Prisma.TransactionClient): Promise<EmployeeAttendanceTotals> {
    const client = tx ?? this.prisma;
    const [byStatus, pending] = await Promise.all([
      client.attendanceRecord.groupBy({
        by: ['status'],
        where: { employeeId },
        _count: { _all: true },
      }),
      client.attendanceRecord.aggregate({
        where: { employeeId, isDeductionApplied: false },
        _sum: { deductionAmount: true },
      }),
    ]);

    const count = (status: string) => byStatus.find((g) => g.status === status)?._count._all ?? 0;
    return {
      totalPresent: count('PRESENTE'),
      totalLate: count('TARDANZA'),
      totalJustifiedAbsences: count('FALTA_JUSTIFICADA'),
      totalUnjustifiedAbsences: count('FALTA_INJUSTIFICADA'),
      pendingDeductionAmount: Number(pending._sum.deductionAmount ?? 0),
    };
  }

  async summarizeMonth(
    companyId: string,
    month: string,
    tx?: Prisma.TransactionClient,
  ): Promise<MonthlyAttendanceItem[]> {
    const client = tx ?? this.prisma;
    const { start, end } = monthRange(month);

    const records = await client.attendanceRecord.findMany({
      where: {
        employee: { operatingCompanyId: companyId },
        date: { gte: start, lte: end },
        ...DEDUCTIBLE_WHERE,
      },
      include: { employee: { select: { fullName: true, areaName: true } } },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, MonthlyAttendanceItem & { allApplied: boolean }>();
    for (const record of records) {
      const current = grouped.get(record.employeeId) ?? {
        employeeId: record.employeeId,
        employeeName: record.employee.fullName,
        areaName: record.employee.areaName,
        totalLates: 0,
        totalUnjustified: 0,
        calculatedDeduction: 0,
        isApplied: false,
        allApplied: true,
      };
      if (record.status === 'FALTA_INJUSTIFICADA') current.totalUnjustified += 1;
      if (record.status === 'TARDANZA') current.totalLates += 1;
      current.calculatedDeduction += Number(record.deductionAmount);
      if (!record.isDeductionApplied) current.allApplied = false;
      grouped.set(record.employeeId, current);
    }

    return Array.from(grouped.values()).map(({ allApplied, ...item }) => ({
      ...item,
      calculatedDeduction: Math.round(item.calculatedDeduction * 100) / 100,
      isApplied: allApplied,
    }));
  }

  async findPendingDeductions(
    companyId: string,
    month: string,
    employeeIds?: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<PendingDeductionItem[]> {
    const client = tx ?? this.prisma;
    const { start, end } = monthRange(month);

    const records = await client.attendanceRecord.findMany({
      where: {
        employee: {
          operatingCompanyId: companyId,
          ...(employeeIds && employeeIds.length > 0 ? { id: { in: employeeIds } } : {}),
        },
        date: { gte: start, lte: end },
        isDeductionApplied: false,
        ...DEDUCTIBLE_WHERE,
      },
      include: { employee: { select: { fullName: true, areaName: true } } },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, PendingDeductionItem>();
    for (const record of records) {
      const current = grouped.get(record.employeeId) ?? {
        employeeId: record.employeeId,
        employeeName: record.employee.fullName,
        areaName: record.employee.areaName,
        totalLates: 0,
        totalUnjustified: 0,
        calculatedDeduction: 0,
        attendanceIds: [],
      };
      if (record.status === 'FALTA_INJUSTIFICADA') current.totalUnjustified += 1;
      if (record.status === 'TARDANZA') current.totalLates += 1;
      current.calculatedDeduction += Number(record.deductionAmount);
      current.attendanceIds.push(record.id);
      grouped.set(record.employeeId, current);
    }

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      calculatedDeduction: Math.round(item.calculatedDeduction * 100) / 100,
    }));
  }

  async applyDeductions(
    attendanceIds: string[],
    payrollMonth: string,
    appliedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const result = await client.attendanceRecord.updateMany({
      where: { id: { in: attendanceIds }, isDeductionApplied: false },
      data: { isDeductionApplied: true, payrollMonth, deductionAppliedAt: appliedAt },
    });
    return result.count;
  }
}
