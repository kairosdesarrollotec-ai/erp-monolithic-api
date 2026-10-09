/** TDD-TPL §6.2 — Respuesta de URL de subida firmada. */
export interface TemplateUploadUrlResponse {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: string;
}
