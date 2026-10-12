/**
 * REP-01 — KPIs financieros del período.
 * BDD-REP-001 UC-REP-002 / BR-REP-002 / BR-REP-004 / BR-REP-005.
 */
export class GetFinancialKpisQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly dateFrom: Date,
    public readonly dateTo: Date,
  ) {}
}
