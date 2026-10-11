/** TDD-TPL §6.5 — Obtener plantilla por ID. */
export class GetTemplateQuery {
  constructor(
    readonly id: string,
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
  ) {}
}
