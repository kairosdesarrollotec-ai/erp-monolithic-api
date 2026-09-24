export class GetMyNotificationsQuery {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly unreadOnly?: boolean,
  ) {}
}
