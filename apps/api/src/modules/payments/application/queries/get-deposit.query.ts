export class GetDepositQuery {
  constructor(
    readonly depositId: string,
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
  ) {}
}
