import type { IncidentDetailRecord, IncidentRecord } from '../../application/ports/incident-repository.port';
import type { IncidentDetailResponse, IncidentResponse } from './dto/incident.response';

export function toIncidentResponse(record: IncidentRecord): IncidentResponse {
  return {
    id: record.id,
    companyId: record.operatingCompanyId,
    branchId: record.branchId,
    rentalId: record.rentalId,
    rentalCode: null,
    returnId: record.returnId,
    type: record.type,
    severity: record.severity,
    status: record.status,
    description: record.description,
    suggestion: record.suggestion,
    reportedAt: record.reportedAt.toISOString(),
    responsibleUserId: record.responsibleUserId,
    resolutionSummary: record.resolutionSummary,
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toIncidentDetailResponse(record: IncidentDetailRecord): IncidentDetailResponse {
  return {
    ...toIncidentResponse(record),
    actions: record.actions.map((action) => ({
      id: action.id,
      kind: action.kind,
      description: action.description,
      authorUserId: action.authorUserId,
      createdAt: action.createdAt.toISOString(),
    })),
  };
}
