import { Module } from '@nestjs/common';
import { ReservationsController } from './presentation/http/reservations.controller';
import { CreateReservationHandler } from './application/commands/create-reservation.handler';
import { RegisterPaymentHandler } from './application/commands/register-payment.handler';
import { RegisterDocumentsHandler } from './application/commands/register-documents.handler';
import { ConfirmReservationHandler } from './application/commands/confirm-reservation.handler';
import { CancelReservationHandler } from './application/commands/cancel-reservation.handler';
import { GetReservationHandler } from './application/queries/get-reservation.handler';
import { ListReservationsHandler } from './application/queries/list-reservations.handler';
import { ReservationRepositoryPort } from './application/ports/reservation-repository.port';
import { PrismaReservationRepository } from './infrastructure/persistence/prisma-reservation.repository';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

/**
 * HU-27 (Reserva, RES-01/RES-04/RES-05). Importa UsersModule solo para
 * reutilizar WorkContextRepositoryPort (resolucion/validacion de
 * empresa-sede, mismo patron que TR-05/TR-06) - no expone ningun
 * controller de Users adicional.
 */
@Module({
  imports: [UsersModule, AuditModule],
  controllers: [ReservationsController],
  providers: [
    CreateReservationHandler,
    RegisterPaymentHandler,
    RegisterDocumentsHandler,
    ConfirmReservationHandler,
    CancelReservationHandler,
    GetReservationHandler,
    ListReservationsHandler,
    { provide: ReservationRepositoryPort, useClass: PrismaReservationRepository },
  ],
})
export class ReservationsModule {}
