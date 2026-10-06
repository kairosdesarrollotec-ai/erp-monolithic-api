import type { Prisma } from '@prisma/client';
import type { IncidentActionRecord, IncidentDetailRecord, IncidentRecord } from '../../application/ports/incident-repository.port';

export const INCIDENT_DETAIL_INCLUDE = {
  actions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.IncidentInclude;

type IncidentRow = Prisma.IncidentGetPayload<object>;
type IncidentActionRow = Prisma.IncidentActionGetPayload<object>;
type IncidentDetailRow = Prisma.IncidentGetPayload<{ include: typeof INCIDENT_DETAIL_INCLUDE }>;

export function toIncidentRecord(row: IncidentRow): IncidentRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    rentalId: row.rentalId,
    returnId: row.returnId,
    type: row.type,
    severity: row.severity,
    status: row.status,
    description: row.description,
    suggestion: row.suggestion,
    reportedAt: row.reportedAt,
    responsibleUserId: row.responsibleUserId,
    resolutionSummary: row.resolutionSummary,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    version: row.version,
  };
}

export function toIncidentActionRecord(row: IncidentActionRow): IncidentActionRecord {
  return {
    id: row.id,
    incidentId: row.incidentId,
    kind: row.kind,
    description: row.description,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt,
  };
}

export function toIncidentDetailRecord(row: IncidentDetailRow): IncidentDetailRecord {
  return { ...toIncidentRecord(row), actions: row.actions.map(toIncidentActionRecord) };
}
