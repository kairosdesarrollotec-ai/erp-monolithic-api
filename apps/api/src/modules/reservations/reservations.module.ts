import { Module } from '@nestjs/common';
import { ReservationsController } from './presentation/http/reservations.controller';
import { CreateReservationHandler } from './application/commands/create-reservation.handler';
import { RegisterPaymentHandler } from './application/commands/register-payment.handler';
import { RegisterDocumentsHandler } from './application/commands/register-documents.handler';
import { ConfirmReservationHandler } from './application/commands/confirm-reservation.handler';
import { CancelReservationHandler } from './application/commands/cancel-reservation.handler';
import { FlagVehicleSaleHandler } from './application/commands/flag-vehicle-sale.handler';
import { ChangeReservationVehicleHandler } from './application/commands/change-reservation-vehicle.handler';
import { ResolveVehicleSaleHandler } from './application/commands/resolve-vehicle-sale.handler';
import { SaleAlternativeVehicleGuard } from './application/services/sale-alternative-vehicle.guard';
import { ReservationSaleResolutionRepositoryPort } from './application/ports/reservation-sale-resolution-repository.port';
import { PrismaReservationSaleResolutionRepository } from './infrastructure/persistence/prisma-reservation-sale-resolution.repository';
import { GetReservationHandler } from './application/queries/get-reservation.handler';
import { ListReservationsHandler } from './application/queries/list-reservations.handler';
import { ReservationRepositoryPort } from './application/ports/reservation-repository.port';
import { ReservationDocumentRepositoryPort } from './application/ports/reservation-document-repository.port';
import { ReservationDocumentStoragePort } from './application/ports/reservation-document-storage.port';
import { PrismaReservationRepository } from './infrastructure/persistence/prisma-reservation.repository';
import { PrismaReservationDocumentRepository } from './infrastructure/persistence/prisma-reservation-document.repository';
import { GcsReservationDocumentService } from './infrastructure/storage/gcs-reservation-document.service';
import { RequestReservationDocumentUploadSessionHandler } from './application/commands/request-reservation-document-upload-session.handler';
import { RecordReservationDocumentHandler } from './application/commands/record-reservation-document.handler';
import { ListReservationDocumentsHandler } from './application/queries/list-reservation-documents.handler';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';

import { ConfirmSaleRefundTransferHandler } from './application/commands/confirm-sale-refund-transfer.handler';
import { RegisterReservationReminderHandler } from './application/commands/register-reservation-reminder.handler';
import { ReservationReminderRepositoryPort } from './application/ports/reservation-reminder-repository.port';
import { PrismaReservationReminderRepository } from './infrastructure/persistence/prisma-reservation-reminder.repository';
import { RequestReservationAirportServiceHandler } from './application/commands/request-airport-service.handler';
import { GetReservationAirportServiceHandler } from './application/queries/get-reservation-airport-service.handler';
import { AirportServiceRepositoryPort } from './application/ports/airport-service-repository.port';
import { PrismaAirportServiceRepository } from './infrastructure/persistence/prisma-airport-service.repository';

/**
 * HU-27 (Reserva, RES-01/RES-04/RES-05). Importa UsersModule para
 * reutilizar WorkContextAuthorizationService y AuthorizationModule para
 * aplicar la matriz de roles y permisos versionada (ADM-02).
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [ReservationsController],
  providers: [
    CreateReservationHandler,
    RegisterPaymentHandler,
    RegisterDocumentsHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
    FlagVehicleSaleHandler,
    ResolveVehicleSaleHandler,
    ChangeReservationVehicleHandler,
    SaleAlternativeVehicleGuard,
    GetReservationHandler,
    ListReservationsHandler,
    RequestReservationDocumentUploadSessionHandler,
    RecordReservationDocumentHandler,
    ListReservationDocumentsHandler,
    ConfirmSaleRefundTransferHandler,
    RegisterReservationReminderHandler,
    RequestReservationAirportServiceHandler,
    GetReservationAirportServiceHandler,
    { provide: ReservationRepositoryPort, useClass: PrismaReservationRepository },
    { provide: ReservationSaleResolutionRepositoryPort, useClass: PrismaReservationSaleResolutionRepository },
    { provide: ReservationDocumentRepositoryPort, useClass: PrismaReservationDocumentRepository },
    { provide: ReservationDocumentStoragePort, useClass: GcsReservationDocumentService },
    { provide: ReservationReminderRepositoryPort, useClass: PrismaReservationReminderRepository },
    { provide: AirportServiceRepositoryPort, useClass: PrismaAirportServiceRepository },
  ],
  exports: [ReservationRepositoryPort, AirportServiceRepositoryPort],
})
export class ReservationsModule {}
