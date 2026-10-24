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
import { FleetAccessService } from './application/services/fleet-access.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OutboxModule } from '../outbox/outbox.module';

import { RecordVehicleOperationalFormatHandler } from './application/commands/record-vehicle-operational-format.handler';
import { ListVehicleOperationalRecordsHandler } from './application/queries/list-vehicle-operational-records.handler';
import { ListVehicleOperationalRemindersHandler } from './application/queries/list-vehicle-operational-reminders.handler';
import { VehicleFormatReminderScheduler } from './application/services/vehicle-format-reminder.scheduler';

@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule],
  controllers: [FleetController],
  providers: [
    FleetAccessService,
    CreateVehicleHandler,
    UpdateVehicleStatusHandler,
    UpdateVehicleHandler,
    ListVehiclesHandler,
    GetVehicleHandler,
    RequestPhotoUploadSessionHandler,
    RecordVehicleOperationalFormatHandler,
    ListVehicleOperationalRecordsHandler,
    ListVehicleOperationalRemindersHandler,
    VehicleFormatReminderScheduler,
    { provide: FleetVehicleRepositoryPort, useClass: PrismaFleetVehicleRepository },
    { provide: VehiclePhotoStoragePort, useClass: GcsVehiclePhotoService },
  ],
  exports: [FleetVehicleRepositoryPort, VehicleFormatReminderScheduler],
})
export class FleetModule {}
