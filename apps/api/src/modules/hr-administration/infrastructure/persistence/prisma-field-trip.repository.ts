import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FieldTripRequest, FieldTripStatus } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateFieldTripData,
  FieldTripRepositoryPort,
  FieldTripWithEmployee,
  ListFieldTripsFilters,
  UpdateFieldTripData,
} from '../../application/ports/field-trip-repository.port';
import { FieldTripNotAuthorizedError, FieldTripNotPendingError } from '../../domain/hr-administration-errors';

const EMPLOYEE_SELECT = {
  id: true,
  fullName: true,
  areaName: true,
  jobTitle: true,
  fieldTripLateCount: true,
  isFieldTripObserved: true,
  organizationId: true,
  operatingCompanyId: true,
  branchId: true,
} as const;

const DEFAULT_LIMIT = 100;

@Injectable()
export class PrismaFieldTripRepository implements FieldTripRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFieldTripData, tx?: Prisma.TransactionClient): Promise<FieldTripRequest> {
    const client = tx ?? this.prisma;
    return client.fieldTripRequest.create({
      data: {
        employeeId: data.employeeId,
        destination: data.destination,
        objective: data.objective,
        estimatedDeparture: data.estimatedDeparture,
        estimatedReturn: data.estimatedReturn,
        status: 'PENDIENTE_NIVEL_1',
        level1TimeoutAt: data.level1TimeoutAt,
      },
    });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<FieldTripWithEmployee | null> {
    const client = tx ?? this.prisma;
    return client.fieldTripRequest.findUnique({
      where: { id },
      include: { employee: { select: EMPLOYEE_SELECT } },
    });
  }

  async findMany(filters: ListFieldTripsFilters, tx?: Prisma.TransactionClient): Promise<FieldTripWithEmployee[]> {
    const client = tx ?? this.prisma;
    return client.fieldTripRequest.findMany({
      where: {
        employee: {
          operatingCompanyId: filters.companyId,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
        },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), 200),
    });
  }

  async claimNextDueForEscalation(now: Date, tx: Prisma.TransactionClient): Promise<string | null> {
    // Sin `level1_timeout_at` (filas anteriores al temporizador) se cuenta 5 min desde la creación.
    // Las columnas son TIMESTAMP(3) sin zona (UTC): el instante se compara también en UTC.
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM field_trip_requests
      WHERE (status = 'PENDIENTE_NIVEL_1'
             AND COALESCE(level1_timeout_at, created_at + interval '5 minutes') <= (${now}::timestamptz AT TIME ZONE 'UTC'))
         OR (status = 'PENDIENTE_NIVEL_2' AND level2_timeout_at <= (${now}::timestamptz AT TIME ZONE 'UTC'))
         OR (status = 'PENDIENTE_NIVEL_3' AND level3_timeout_at <= (${now}::timestamptz AT TIME ZONE 'UTC'))
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);
    return rows[0]?.id ?? null;
  }

  async transition(
    id: string,
    from: readonly FieldTripStatus[],
    data: UpdateFieldTripData,
    tx?: Prisma.TransactionClient,
  ): Promise<FieldTripRequest> {
    const client = tx ?? this.prisma;
    const result = await client.fieldTripRequest.updateMany({
      where: { id, status: { in: [...from] } },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.authorizationLevel !== undefined ? { authorizationLevel: data.authorizationLevel } : {}),
        ...(data.authorizedById !== undefined ? { authorizedById: data.authorizedById } : {}),
        ...(data.authorizedByName !== undefined ? { authorizedByName: data.authorizedByName } : {}),
        ...(data.authorizedAt !== undefined ? { authorizedAt: data.authorizedAt } : {}),
        ...(data.actualDeparture !== undefined ? { actualDeparture: data.actualDeparture } : {}),
        ...(data.actualReturn !== undefined ? { actualReturn: data.actualReturn } : {}),
        ...(data.lateMinutes !== undefined ? { lateMinutes: data.lateMinutes } : {}),
        ...(data.returnNotes !== undefined ? { returnNotes: data.returnNotes } : {}),
        ...(data.level2TimeoutAt !== undefined ? { level2TimeoutAt: data.level2TimeoutAt } : {}),
        ...(data.level3TimeoutAt !== undefined ? { level3TimeoutAt: data.level3TimeoutAt } : {}),
        ...(data.rejectedById !== undefined ? { rejectedById: data.rejectedById } : {}),
        ...(data.rejectedByName !== undefined ? { rejectedByName: data.rejectedByName } : {}),
        ...(data.rejectedAt !== undefined ? { rejectedAt: data.rejectedAt } : {}),
        ...(data.rejectedAtLevel !== undefined ? { rejectedAtLevel: data.rejectedAtLevel } : {}),
        ...(data.rejectionReason !== undefined ? { rejectionReason: data.rejectionReason } : {}),
      },
    });

    const reloaded = await client.fieldTripRequest.findUniqueOrThrow({ where: { id } });
    if (result.count === 0) {
      if (from.length === 1 && from[0] === 'AUTORIZADA') {
        throw new FieldTripNotAuthorizedError(id, reloaded.status);
      }
      throw new FieldTripNotPendingError(id, reloaded.status);
    }
    return reloaded;
  }
}
