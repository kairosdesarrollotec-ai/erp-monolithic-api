/**
 * DAT-REC-004 - Puerto de almacenamiento privado para el CV del candidato.
 * El binario nunca pasa por la API: se sube con una URL firmada de escritura y se lee con una URL firmada
 * de lectura de vida corta (solo para quien tiene permiso de datos sensibles).
 */
export interface CandidateCvScope {
  companyId: string;
  candidateId: string;
}

export interface CandidateCvUploadSession {
  uploadUrl: string;
  objectUrl: string;
  expiresAt: Date;
  /** Cabeceras que el cliente debe enviar tal cual en el PUT (forman parte de la firma). */
  uploadHeaders: Record<string, string>;
}

export interface CandidateCvObjectMetadata {
  sizeBytes: number;
  contentType: string | null;
}

export abstract class CandidateCvStoragePort {
  abstract generateSignedUploadUrl(
    params: CandidateCvScope & { contentType: string; maxBytes: number },
  ): Promise<CandidateCvUploadSession>;

  /** true si el objeto fue generado por una sesion de subida de ESTA empresa y candidato. */
  abstract isOwnedObjectUrl(objectUrl: string, scope: CandidateCvScope): boolean;

  /** Metadatos reales del objeto subido; null si no existe. */
  abstract getObjectMetadata(objectUrl: string): Promise<CandidateCvObjectMetadata | null>;

  abstract generateSignedReadUrl(
    objectUrl: string,
    params: { fileName: string; contentType: string },
  ): Promise<{ url: string; expiresAt: Date }>;
}
