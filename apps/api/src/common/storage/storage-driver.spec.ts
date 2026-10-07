import { assertStorageDriverAllowed, getStorageDriver } from './storage-driver';

describe('storage driver', () => {
  it('usa gcs por defecto', () => {
    expect(getStorageDriver({})).toBe('gcs');
    expect(getStorageDriver({ STORAGE_DRIVER: 'GCS' })).toBe('gcs');
  });

  it('acepta local fuera de producción', () => {
    expect(getStorageDriver({ STORAGE_DRIVER: 'local' })).toBe('local');
    expect(() => assertStorageDriverAllowed({ STORAGE_DRIVER: 'local', NODE_ENV: 'development' })).not.toThrow();
  });

  it('falla con local en producción', () => {
    expect(() => assertStorageDriverAllowed({ STORAGE_DRIVER: 'local', NODE_ENV: 'production' })).toThrow(
      /no está permitido/,
    );
    expect(() => assertStorageDriverAllowed({ STORAGE_DRIVER: 'gcs', NODE_ENV: 'production' })).not.toThrow();
  });

  it('rechaza valores desconocidos', () => {
    expect(() => getStorageDriver({ STORAGE_DRIVER: 's3' })).toThrow(/inválido/);
  });
});
