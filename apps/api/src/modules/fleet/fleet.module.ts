import { Module } from '@nestjs/common';
import { FleetController } from './presentation/http/fleet.controller';
import { CreateVehicleHandler } from './application/commands/create-vehicle.handler';
import { UpdateVehicleStatusHandler } from './application/commands/update-vehicle-status.handler';
import { ListVehiclesHandler } from './application/queries/list-vehicles.handler';
import { GetVehicleHandler } from './application/queries/get-vehicle.handler';
import { FleetVehicleRepositoryPort } from './application/ports/fleet-vehicle-repository.port';
import { PrismaFleetVehicleRepository } from './infrastructure/persistence/prisma-fleet-vehicle.repository';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [FleetController],
  providers: [
    CreateVehicleHandler,
    UpdateVehicleStatusHandler,
    ListVehiclesHandler,
    GetVehicleHandler,
    { provide: FleetVehicleRepositoryPort, useClass: PrismaFleetVehicleRepository },
  ],
  exports: [FleetVehicleRepositoryPort],
})
export class FleetModule {}
