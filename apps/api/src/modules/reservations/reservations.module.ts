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
 * HU-27 (Reserva, RES-01/RES-04/RES-05). Importa UsersModule para
 * reutilizar WorkContextAuthorizationService (autorizacion unica de
 * contexto empresa/sede, mismo patron que TR-05/TR-06 desde la
 * correccion de PR#5 - hallazgo alto de revision PR#6 "no usa el
 * servicio central") - no expone ningun controller de Users adicional.
 * TransactionManagerPort (usado por Confirm/Cancel) se resuelve desde
 * PrismaModule, que es @Global(); IdempotencyPort/IdempotencyInterceptor
 * desde IdempotencyModule (@Global(), common/http - compartido con
 * Consulta desde la revalidacion de PR#7).
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
  // ReservationRepositoryPort se exporta para que InquiriesModule
  // (HU-26/Consulta) pueda crear la Reservation atomicamente al
  // convertir una consulta (hallazgo critico de revision PR#7,
  // "convertir no crea reserva") sin reimplementar su propia logica de
  // persistencia de Reserva.
  exports: [ReservationRepositoryPort],
})
export class ReservationsModule {}
