import type { IncidentSeverity, IncidentType } from '../../domain/incident-catalog';

export class CreateIncidentCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly rentalId: string,
    public readonly type: IncidentType,
    public readonly severity: IncidentSeverity,
    public readonly description: string,
    public readonly returnId?: string,
    public readonly suggestion?: string,
    public readonly reportedAt?: Date,
    public readonly responsibleUserId?: string,
  ) {}
}
