export class CancelRentalCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** DOCUMENTS_INVALID | CUSTOMER_REJECTED_NOTARY | OTHER (OTHER exige nota >= 10 caracteres). */
    public readonly reason: string,
    public readonly note?: string,
  ) {}
}
