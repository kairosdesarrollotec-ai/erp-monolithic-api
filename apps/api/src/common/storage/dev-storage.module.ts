import { DynamicModule, Module } from '@nestjs/common';
import { DevStorageController } from './dev-storage.controller';
import { assertStorageDriverAllowed, isLocalStorageDriver } from './storage-driver';

/**
 * Registra los endpoints /dev-storage/* únicamente con STORAGE_DRIVER=local.
 * Con el driver gcs (por defecto) el módulo queda vacío: no expone ninguna ruta.
 */
@Module({})
export class DevStorageModule {
  static register(): DynamicModule {
    assertStorageDriverAllowed();
    return {
      module: DevStorageModule,
      controllers: isLocalStorageDriver() ? [DevStorageController] : [],
    };
  }
}
