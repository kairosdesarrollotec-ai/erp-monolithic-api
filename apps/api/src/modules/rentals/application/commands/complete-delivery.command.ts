export class CompleteDeliveryCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly photosCount: number,
    public readonly videosCount: number,
    public readonly notes?: string,
  ) {}
}
