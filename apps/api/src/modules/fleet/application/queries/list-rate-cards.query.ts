export class ListRateCardsQuery {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly limit: number,
    readonly offset: number,
  ) {}
}
