/**
 * REP-01 — Exportación de datos del período en CSV.
 * BDD-REP-001 UC-REP-003 / BR-REP-003 / BR-REP-005.
 */
export class ExportReportQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly dateFrom: Date,
    public readonly dateTo: Date,
    public readonly type: 'operational' | 'financial' | 'combined',
  ) {}
}
