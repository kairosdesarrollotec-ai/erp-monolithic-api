export class GetCurrentRateCardQuery {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
  ) {}
}
