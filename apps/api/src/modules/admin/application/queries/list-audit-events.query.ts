export class ListAuditEventsQuery {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly filterActorUid?: string,
    public readonly entityType?: string,
    public readonly dateFrom?: string,
    public readonly dateTo?: string,
  ) {}
}
