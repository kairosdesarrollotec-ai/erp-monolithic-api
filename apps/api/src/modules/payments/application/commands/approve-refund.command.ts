export class ApproveRefundCommand {
  constructor(
    readonly depositId: string,
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly notes?: string,
  ) {}
}
