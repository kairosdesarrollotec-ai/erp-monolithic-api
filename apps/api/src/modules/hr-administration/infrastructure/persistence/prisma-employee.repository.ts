import { Injectable } from '@nestjs/common';
import type { Employee, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateEmployeeData,
  EmployeeRepositoryPort,
  ListEmployeesFilters,
  TerminateEmployeeData,
  UpdateEmployeeData,
} from '../../application/ports/employee-repository.port';
import { EmploymentAlreadyTerminatedError } from '../../domain/hr-administration-errors';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee> {
    const client = tx ?? this.prisma;
    return client.employee.create({
      data: {
        organizationId: data.organizationId,
        operatingCompanyId: data.operatingCompanyId,
        branchId: data.branchId,
        candidateId: data.candidateId ?? null,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        areaId: data.areaId,
        areaName: data.areaName,
        jobTitle: data.jobTitle,
        status: data.status ?? 'PERIODO_PRUEBA',
        hireDate: data.hireDate,
        baseSalary: data.baseSalary ?? null,
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Employee | null> {
    const client = tx ?? this.prisma;
    return client.employee.findUnique({ where: { id } });
  }

  async findByCompanyAndDocument(
    companyId: string,
    documentNumber: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee | null> {
    const client = tx ?? this.prisma;
    return client.employee.findFirst({ where: { operatingCompanyId: companyId, documentNumber } });
  }

  async findMany(
    filters: ListEmployeesFilters,
    tx?: Prisma.TransactionClient,
  ): Promise<{ items: Employee[]; total: number }> {
    const client = tx ?? this.prisma;
    const where: Prisma.EmployeeWhereInput = {
      organizationId: filters.organizationId,
      operatingCompanyId: filters.companyId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: 'insensitive' } },
              { documentNumber: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const take = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const [items, total] = await Promise.all([
      client.employee.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        take,
        skip: Math.max(filters.offset ?? 0, 0),
      }),
      client.employee.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, data: UpdateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee> {
    const client = tx ?? this.prisma;
    return client.employee.update({
      where: { id },
      data: {
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
        ...(data.areaName !== undefined ? { areaName: data.areaName } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.probationPassed !== undefined ? { probationPassed: data.probationPassed } : {}),
        ...(data.probationEvaluatedAt !== undefined ? { probationEvaluatedAt: data.probationEvaluatedAt } : {}),
        ...(data.payrollStartedAt !== undefined ? { payrollStartedAt: data.payrollStartedAt } : {}),
        ...(data.baseSalary !== undefined ? { baseSalary: data.baseSalary } : {}),
        ...(data.fieldTripLateCount !== undefined ? { fieldTripLateCount: data.fieldTripLateCount } : {}),
        ...(data.isFieldTripObserved !== undefined ? { isFieldTripObserved: data.isFieldTripObserved } : {}),
        version: { increment: 1 },
      },
    });
  }

  async markTerminated(id: string, data: TerminateEmployeeData, tx?: Prisma.TransactionClient): Promise<Employee> {
    const client = tx ?? this.prisma;
    const result = await client.employee.updateMany({
      where: { id, status: { not: 'TERMINADO' } },
      data: {
        status: 'TERMINADO',
        terminatedAt: data.terminatedAt,
        terminationReason: data.terminationReason,
        terminationNoticeDays: data.terminationNoticeDays,
        terminationNotes: data.terminationNotes ?? null,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new EmploymentAlreadyTerminatedError(id);
    }
    return client.employee.findUniqueOrThrow({ where: { id } });
  }
}
