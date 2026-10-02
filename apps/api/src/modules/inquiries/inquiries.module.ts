import { Module } from '@nestjs/common';
import { InquiriesController } from './presentation/http/inquiries.controller';
import { RegisterInquiryHandler } from './application/commands/register-inquiry.handler';
import { QuoteHandler } from './application/commands/quote.handler';
import { CloseInquiryHandler } from './application/commands/close-inquiry.handler';
import { ConvertToReservationHandler } from './application/commands/convert-to-reservation.handler';
import { GetInquiryHandler } from './application/queries/get-inquiry.handler';
import { ListInquiriesHandler } from './application/queries/list-inquiries.handler';
import { InquiryRepositoryPort } from './application/ports/inquiry-repository.port';
import { FleetAvailabilityPort } from './application/ports/fleet-availability.port';
import {
  PROVISIONAL_QUOTING_POLICY,
  ProvisionalQuotingGuard,
  provisionalQuotingPolicyFromEnv,
} from './application/services/provisional-quoting.guard';
import { PrismaInquiryRepository } from './infrastructure/persistence/prisma-inquiry.repository';
import { PrismaFleetAvailabilityAdapter } from './infrastructure/fleet/prisma-fleet-availability.adapter';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { OutboxModule } from '../outbox/outbox.module';
import { ParametersModule } from '../parameters/parameters.module';
import { AuthorizationModule } from '../authorization/authorization.module';

/**
 * HU-26 (Consulta, CON-01..CON-04).
 * - UsersModule: WorkContextAuthorizationService (contexto empresa/sede).
 * - AuthorizationModule: MatrixAuthorizationService (enforcement versionado ADM-02).
 * - ReservationsModule: ReservationRepositoryPort, para crear la Reserva
 *   dentro de la misma transaccion de la conversion (caso de uso unico).
 * - PrismaModule/IdempotencyModule (@Global): TransactionManagerPort,
 *   ClockPort, IdempotencyInterceptor.
 * - FleetAvailabilityPort: PrismaFleetAvailabilityAdapter (productionReady=true),
 *   tambien fuente del precio de cotizacion (Vehicle.dailyRate) desde oct
 *   2026 - RateCardPort/rate_card_versions queda sin uso (ver
 *   quote.handler.ts y fleet-availability.port.ts).
 * - ProvisionalQuotingGuard queda como salvaguarda: si el adaptador de
 *   Flota es productionReady, el assert pasa y cotizar funciona en
 *   produccion sin variable de entorno.
 */
@Module({
  imports: [UsersModule, AuditModule, ReservationsModule, OutboxModule, ParametersModule, AuthorizationModule],
  controllers: [InquiriesController],
  providers: [
    RegisterInquiryHandler,
    QuoteHandler,
    CloseInquiryHandler,
    ConvertToReservationHandler,
    GetInquiryHandler,
    ListInquiriesHandler,
    ProvisionalQuotingGuard,
    { provide: InquiryRepositoryPort, useClass: PrismaInquiryRepository },
    { provide: FleetAvailabilityPort, useClass: PrismaFleetAvailabilityAdapter },
    { provide: PROVISIONAL_QUOTING_POLICY, useFactory: () => provisionalQuotingPolicyFromEnv(process.env) },
  ],
})
export class InquiriesModule {}
