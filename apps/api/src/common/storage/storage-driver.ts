/**
 * Selector del driver de almacenamiento de objetos (fotos/video/documentos).
 *
 * - `gcs` (por defecto): Google Cloud Storage con URLs firmadas v4.
 * - `local`: disco local, SOLO desarrollo. Nunca permitido con NODE_ENV=production.
 */
export type StorageDriver = 'gcs' | 'local';

export function getStorageDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  const raw = (env.STORAGE_DRIVER ?? 'gcs').trim().toLowerCase();
  if (raw === '' || raw === 'gcs') return 'gcs';
  if (raw === 'local') return 'local';
  throw new Error(`STORAGE_DRIVER inválido: "${env.STORAGE_DRIVER}". Valores permitidos: gcs | local.`);
}

export function isLocalStorageDriver(env: NodeJS.ProcessEnv = process.env): boolean {
  return getStorageDriver(env) === 'local';
}

/** Falla al arrancar si se intenta usar el driver local en producción. */
export function assertStorageDriverAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (getStorageDriver(env) === 'local' && env.NODE_ENV === 'production') {
    throw new Error(
      'STORAGE_DRIVER=local no está permitido con NODE_ENV=production: es un driver solo para desarrollo. ' +
        'Usa STORAGE_DRIVER=gcs (o elimina la variable).',
    );
  }
}
