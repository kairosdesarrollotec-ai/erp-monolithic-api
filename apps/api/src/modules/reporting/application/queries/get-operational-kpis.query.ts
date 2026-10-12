/**
 * REP-01 — KPIs operativos en tiempo real.
 * BDD-REP-001 UC-REP-001 / BR-REP-001 / BR-REP-004.
 */
export class GetOperationalKpisQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly dateFrom: Date,
    public readonly dateTo: Date,
  ) {}
}
