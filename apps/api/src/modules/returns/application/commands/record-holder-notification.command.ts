export class RecordHolderNotificationCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number | undefined,
    public readonly channel: string,
    public readonly contactedAt: Date,
    public readonly notifiedBy: string,
    public readonly observations?: string,
  ) {}
}
