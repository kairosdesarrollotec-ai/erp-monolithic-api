/**
 * TDD-KAIROS-MVP-002-TPL §5 + TDD-TPL-ADR-001 — Port de almacenamiento GCS.
 * No depende de NestJS ni de la implementación concreta.
 */
export interface TemplateUploadUrlParams {
  companyId: string;
  type: string;
  contentType: string;
}

export interface TemplateUploadUrlResult {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: Date;
}

export abstract class TemplateStoragePort {
  /**
   * Genera una signed PUT URL válida 15 min.
   * Prefijo GCS: `templates/{companyId}/{type}/`
   * MIME permitidos: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
   */
  abstract generateSignedUploadUrl(params: TemplateUploadUrlParams): Promise<TemplateUploadUrlResult>;

  /** Valida que la URL sea HTTPS de GCS del bucket configurado. */
  abstract isValidGcsUrl(url: string): boolean;
}
