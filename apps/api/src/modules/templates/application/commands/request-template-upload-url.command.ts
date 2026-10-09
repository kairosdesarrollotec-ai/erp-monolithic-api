/** TDD-TPL §6.2 — Solicitar URL firmada de subida para una plantilla DRAFT. */
export class RequestTemplateUploadUrlCommand {
  constructor(
    readonly firebaseUid: string,
    readonly templateId: string,
    readonly companyId: string,
    readonly branchId: string,
    readonly contentType: string,
    readonly contentLength: number,
  ) {}
}
