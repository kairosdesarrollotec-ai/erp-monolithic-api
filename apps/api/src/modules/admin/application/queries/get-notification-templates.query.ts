export class GetNotificationTemplatesQuery {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
  ) {}
}
