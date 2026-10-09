/** TDD-TPL §6.1 — Crear plantilla en estado DRAFT. */
export class CreateTemplateCommand {
  constructor(
    readonly firebaseUid: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly type: string,
    readonly name: string,
    readonly effectiveFrom?: Date,
  ) {}
}
