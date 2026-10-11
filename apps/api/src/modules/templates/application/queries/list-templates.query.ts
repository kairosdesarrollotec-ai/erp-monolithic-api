/** TDD-TPL §6.4 — Listar plantillas con filtros opcionales. */
export class ListTemplatesQuery {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly type?: string,
    readonly status?: string,
  ) {}
}
