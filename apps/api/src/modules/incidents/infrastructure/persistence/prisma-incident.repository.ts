import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AppendIncidentActionInput,
  AppendIncidentActionResult,
  CreateIncidentInput,
  IncidentDetailRecord,
  IncidentRecord,
  IncidentRepositoryPort,
  IncidentScope,
  ListIncidentsFilter,
} from '../../application/ports/incident-repository.port';
import { IncidentNotFoundError, IncidentNotOpenError, IncidentVersionConflictError } from '../../domain/incident-errors';
import {
  INCIDENT_DETAIL_INCLUDE,
  toIncidentActionRecord,
  toIncidentDetailRecord,
  toIncidentRecord,
} from './incident-persistence.mapper';

function scopeWhere(id: string, scope: IncidentScope): Prisma.IncidentWhereInput {
  return {
    id,
    organizationId: scope.organizationId,
    operatingCompanyId: scope.operatingCompanyId,
    branchId: scope.branchId,
  };
}

@Injectable()
export class PrismaIncidentRepository implements IncidentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateIncidentInput, tx: Prisma.TransactionClient): Promise<IncidentDetailRecord> {
    const created = await tx.incident.create({
      data: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        rentalId: input.rentalId,
        returnId: input.returnId,
        type: input.type,
        severity: input.severity,
        description: input.description,
        suggestion: input.suggestion,
        reportedAt: input.reportedAt,
        responsibleUserId: input.responsibleUserId,
        createdAt: input.now,
        createdBy: input.createdBy,
        updatedAt: input.now,
        updatedBy: input.createdBy,
        actions: {
          create: {
            kind: 'REPORTED',
            description: input.description,
            authorUserId: input.createdBy,
            createdAt: input.now,
          },
        },
      },
      include: INCIDENT_DETAIL_INCLUDE,
    });
    return toIncidentDetailRecord(created);
  }

  async findById(id: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentDetailRecord | null> {
    const client = tx ?? this.prisma;
    const found = await client.incident.findFirst({ where: scopeWhere(id, scope), include: INCIDENT_DETAIL_INCLUDE });
    return found ? toIncidentDetailRecord(found) : null;
  }

  async list(filter: ListIncidentsFilter): Promise<IncidentRecord[]> {
    const where: Prisma.IncidentWhereInput = {
      organizationId: filter.organizationId,
      operatingCompanyId: filter.operatingCompanyId,
      branchId: filter.branchId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.rentalId ? { rentalId: filter.rentalId } : {}),
      ...(filter.returnId ? { returnId: filter.returnId } : {}),
      ...(filter.cursor
        ? {
            OR: [
              { createdAt: { lt: filter.cursor.createdAt } },
              { createdAt: filter.cursor.createdAt, id: { lt: filter.cursor.id } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.incident.findMany({
      where,
      take: filter.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toIncidentRecord);
  }

  /**
   * Append-only: INSERT de una entrada del historial + UPDATE condicionado (scope + version esperada + ABIERTA) de la
   * incidencia, siempre con version+1. Nunca se edita ni se borra una entrada previa.
   */
  async appendAction(input: AppendIncidentActionInput, tx: Prisma.TransactionClient): Promise<AppendIncidentActionResult> {
    const result = await tx.incident.updateMany({
      where: { ...scopeWhere(input.id, input.scope), version: input.expectedVersion, status: 'ABIERTA' },
      data: {
        status: input.nextStatus,
        resolutionSummary: input.resolutionSummary,
        resolvedAt: input.resolvedAt,
        updatedBy: input.authorUserId,
        updatedAt: input.now,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await tx.incident.findFirst({ where: scopeWhere(input.id, input.scope), select: { status: true } });
      if (!existing) throw new IncidentNotFoundError(input.id);
      if (existing.status !== 'ABIERTA') throw new IncidentNotOpenError(existing.status);
      throw new IncidentVersionConflictError();
    }

    const action = await tx.incidentAction.create({
      data: {
        incidentId: input.id,
        kind: input.kind,
        description: input.description,
        authorUserId: input.authorUserId,
        createdAt: input.now,
      },
    });
    const updated = await tx.incident.findFirstOrThrow({ where: scopeWhere(input.id, input.scope), include: INCIDENT_DETAIL_INCLUDE });
    return { incident: toIncidentDetailRecord(updated), action: toIncidentActionRecord(action) };
  }
}
