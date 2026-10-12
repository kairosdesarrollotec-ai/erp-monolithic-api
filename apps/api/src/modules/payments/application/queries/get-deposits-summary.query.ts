export class GetDepositsSummaryQuery {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
  ) {}
}
