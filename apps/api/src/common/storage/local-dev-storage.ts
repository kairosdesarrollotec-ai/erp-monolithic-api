import * as path from 'path';

/**
 * Almacenamiento local SOLO para desarrollo (sin bucket de GCS).
 * Se activa únicamente con LOCAL_STORAGE_ENABLED=true, NODE_ENV=development y
 * una API HTTP enlazada a loopback; no debe exponerse en redes compartidas.
 * Reemplaza las URL firmadas de GCS por PUT/GET contra /dev-storage/* de esta misma API.
 */
export function isLocalDevStorageEnabled(): boolean {
  if (process.env.LOCAL_STORAGE_ENABLED !== 'true' || process.env.NODE_ENV !== 'development') return false;

  try {
    const baseUrl = new URL(process.env.API_BASE_URL || `http://localhost:${process.env.PORT ?? 3000}`);
    return baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname);
  } catch {
    return false;
  }
}

export function localDevStorageDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'uploads', 'dev-storage'));
}

export function localDevStorageBaseUrl(): string {
  const base = process.env.API_BASE_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base.replace(/\/$/, '')}/dev-storage/`;
}

/** URL de subida/lectura local para un objectKey (misma URL para PUT y GET). */
export function localDevUploadTarget(objectKey: string): { uploadUrl: string; objectUrl: string } {
  const url = `${localDevStorageBaseUrl()}${objectKey}`;
  return { uploadUrl: url, objectUrl: url };
}

/** objectUrl aceptable al registrar evidencia/documentos: GCS, o /dev-storage solo en modo local. */
export function isTrustedObjectUrl(url: string): boolean {
  if (url.startsWith('https://storage.googleapis.com/')) return true;
  return isLocalDevStorageEnabled() && url.startsWith(localDevStorageBaseUrl());
}
