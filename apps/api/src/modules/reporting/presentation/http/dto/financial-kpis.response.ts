/**
 * Respuesta del endpoint GET /reporting/financial.
 * Contrato: packages/contracts/openapi/reporting.yaml — FinancialKpisResponse.
 */
export interface FinancialKpis {
  rentalRevenue: number;
  depositsHeld: number;
  depositsReturned: number;
  depositsRetained: number;
  depositsPartiallyRetained: number;
  netDepositsRetained: number;
}

export interface FinancialKpisResult {
  companyId: string;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  kpis: FinancialKpis;
  generatedAt: string;
}
