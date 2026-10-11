/** TDD-TPL §6.3 — Activar plantilla y retirar la anterior (atómico). */
export class ActivateTemplateCommand {
  constructor(
    readonly firebaseUid: string,
    readonly templateId: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly objectUrl: string,
    readonly documentFormat: string,
  ) {}
}
