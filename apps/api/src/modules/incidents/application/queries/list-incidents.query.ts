import { INCIDENT_LIST_DEFAULT_LIMIT } from '../../domain/incident-catalog';
import type { IncidentSeverity, IncidentStatus, IncidentType } from '../../domain/incident-catalog';

export class ListIncidentsQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type?: IncidentType,
    public readonly severity?: IncidentSeverity,
    public readonly status?: IncidentStatus,
    public readonly rentalId?: string,
    public readonly returnId?: string,
    public readonly limit: number = INCIDENT_LIST_DEFAULT_LIMIT,
    public readonly cursor?: { createdAt: Date; id: string },
  ) {}
}
