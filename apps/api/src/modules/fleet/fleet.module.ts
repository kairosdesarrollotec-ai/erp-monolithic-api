import { Module } from '@nestjs/common';
import { FleetController } from './presentation/http/fleet.controller';
import { CreateVehicleHandler } from './application/commands/create-vehicle.handler';
import { UpdateVehicleStatusHandler } from './application/commands/update-vehicle-status.handler';
import { UpdateVehicleHandler } from './application/commands/update-vehicle.handler';
import { ListVehiclesHandler } from './application/queries/list-vehicles.handler';
import { GetVehicleHandler } from './application/queries/get-vehicle.handler';
import { RequestPhotoUploadSessionHandler } from './application/commands/request-photo-upload-session.handler';
import { FleetVehicleRepositoryPort } from './application/ports/fleet-vehicle-repository.port';
import { VehiclePhotoStoragePort } from './application/ports/vehicle-photo-storage.port';
import { PrismaFleetVehicleRepository } from './infrastructure/persistence/prisma-fleet-vehicle.repository';
import { GcsVehiclePhotoService } from './infrastructure/storage/gcs-vehicle-photo.service';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [FleetController],
  providers: [
    CreateVehicleHandler,
    UpdateVehicleStatusHandler,
    UpdateVehicleHandler,
    ListVehiclesHandler,
    GetVehicleHandler,
    RequestPhotoUploadSessionHandler,
    { provide: FleetVehicleRepositoryPort, useClass: PrismaFleetVehicleRepository },
    { provide: VehiclePhotoStoragePort, useClass: GcsVehiclePhotoService },
  ],
  exports: [FleetVehicleRepositoryPort],
})
export class FleetModule {}
