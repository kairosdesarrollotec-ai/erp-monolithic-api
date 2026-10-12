/**
 * BUS-01 — GlobalSearchQuery (TDD-BUS-001 §4).
 * Query de solo lectura; no produce efectos secundarios (BR-BUS-007).
 */
export class GlobalSearchQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string | undefined,
    public readonly q: string,
    public readonly limit: number,
    public readonly types: string[] | undefined,
  ) {}
}
