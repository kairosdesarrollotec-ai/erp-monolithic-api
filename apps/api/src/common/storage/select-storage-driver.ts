import { assertStorageDriverAllowed, isLocalStorageDriver } from './storage-driver';

/**
 * Para usar en `useFactory` de los módulos: elige la implementación según STORAGE_DRIVER.
 * Se evalúa al instanciar el provider (después de cargar .env), no al importar el módulo.
 */
export function selectStorageDriver<G, L>(gcs: () => G, local: () => L): G | L {
  assertStorageDriverAllowed();
  return isLocalStorageDriver() ? local() : gcs();
}
