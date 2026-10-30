import { Module } from '@nestjs/common';
import { DevStorageController } from './dev-storage.controller';

/** Solo desarrollo: sirve /dev-storage/* cuando LOCAL_STORAGE_ENABLED=true (ver local-dev-storage.ts). */
@Module({ controllers: [DevStorageController] })
export class DevStorageModule {}
