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
import { IdempotencyPort } from '../../common/application/ports/idempotency.port';
import { PrismaIdempotencyRepository } from '../../common/persistence/prisma-idempotency.repository';
import { IdempotencyInterceptor } from '../../common/http/idempotency.interceptor';

/**
 * HU-27 (Reserva, RES-01/RES-04/RES-05). Importa UsersModule para
 * reutilizar WorkContextAuthorizationService (autorizacion unica de
 * contexto empresa/sede, mismo patron que TR-05/TR-06 desde la
 * correccion de PR#5 - hallazgo alto de revision PR#6 "no usa el
 * servicio central") - no expone ningun controller de Users adicional.
 * TransactionManagerPort (usado por Confirm/Cancel) se resuelve desde
 * PrismaModule, que es @Global().
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
    { provide: IdempotencyPort, useClass: PrismaIdempotencyRepository },
    IdempotencyInterceptor,
  ],
})
export class ReservationsModule {}
