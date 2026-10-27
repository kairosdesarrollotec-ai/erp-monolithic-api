export class ConfirmSaleRefundTransferCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly transferVoucher: string,
    public readonly transferredAt: Date,
    public readonly note?: string,
  ) {}
}
