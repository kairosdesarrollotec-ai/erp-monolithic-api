/**
 * Respuesta del endpoint GET /reporting/operational.
 * Contrato: packages/contracts/openapi/reporting.yaml — OperationalKpisResponse.
 */
export interface DailyRentalEntry {
  date: string;
  count: number;
}

export interface OperationalKpis {
  activeRentals: number;
  activeReservations: number;
  pendingReturns: number;
  availableVehicles: number;
  openIncidents: number;
  fleetOccupancyRate: number;
  dailyRentals: DailyRentalEntry[];
}

export interface OperationalKpisResult {
  companyId: string;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  kpis: OperationalKpis;
  generatedAt: string;
}
