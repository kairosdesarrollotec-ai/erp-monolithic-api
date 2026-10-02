import { Module } from '@nestjs/common';
import { FleetController } from './presentation/http/fleet.controller';
import { RateCardsController } from './presentation/http/rate-cards.controller';
import { CreateVehicleHandler } from './application/commands/create-vehicle.handler';
import { UpdateVehicleStatusHandler } from './application/commands/update-vehicle-status.handler';
import { UpdateVehicleHandler } from './application/commands/update-vehicle.handler';
import { ListVehiclesHandler } from './application/queries/list-vehicles.handler';
import { GetVehicleHandler } from './application/queries/get-vehicle.handler';
import { RequestPhotoUploadSessionHandler } from './application/commands/request-photo-upload-session.handler';
import { CreateRateCardHandler } from './application/commands/create-rate-card.handler';
import { ListRateCardsHandler } from './application/queries/list-rate-cards.handler';
import { GetCurrentRateCardHandler } from './application/queries/get-current-rate-card.handler';
import { FleetVehicleRepositoryPort } from './application/ports/fleet-vehicle-repository.port';
import { VehiclePhotoStoragePort } from './application/ports/vehicle-photo-storage.port';
import { RateCardRepositoryPort } from './application/ports/rate-card-repository.port';
import { PrismaFleetVehicleRepository } from './infrastructure/persistence/prisma-fleet-vehicle.repository';
import { GcsVehiclePhotoService } from './infrastructure/storage/gcs-vehicle-photo.service';
import { PrismaRateCardRepository } from './infrastructure/persistence/prisma-rate-card.repository';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [FleetController, RateCardsController],
  providers: [
    CreateVehicleHandler,
    UpdateVehicleStatusHandler,
    UpdateVehicleHandler,
    ListVehiclesHandler,
    GetVehicleHandler,
    RequestPhotoUploadSessionHandler,
    CreateRateCardHandler,
    ListRateCardsHandler,
    GetCurrentRateCardHandler,
    { provide: FleetVehicleRepositoryPort, useClass: PrismaFleetVehicleRepository },
    { provide: VehiclePhotoStoragePort, useClass: GcsVehiclePhotoService },
    { provide: RateCardRepositoryPort, useClass: PrismaRateCardRepository },
  ],
  exports: [FleetVehicleRepositoryPort, RateCardRepositoryPort],
})
export class FleetModule {}
