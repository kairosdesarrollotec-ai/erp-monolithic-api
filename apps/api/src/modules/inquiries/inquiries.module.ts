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
import { RateCardPort } from './application/ports/rate-card.port';
import {
  PROVISIONAL_QUOTING_POLICY,
  ProvisionalQuotingGuard,
  provisionalQuotingPolicyFromEnv,
} from './application/services/provisional-quoting.guard';
import { PrismaInquiryRepository } from './infrastructure/persistence/prisma-inquiry.repository';
import { FleetModuleAvailabilityAdapter } from './infrastructure/fleet/fleet-module-availability.adapter';
import { ProvisionalRateCardAdapter } from './infrastructure/pricing/provisional-rate-card.adapter';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { OutboxModule } from '../outbox/outbox.module';
import { ParametersModule } from '../parameters/parameters.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FleetModule } from '../fleet/fleet.module';

/**
 * HU-26 (Consulta, CON-01..CON-04).
 * - UsersModule: WorkContextAuthorizationService (contexto empresa/sede).
 * - AuthorizationModule: MatrixAuthorizationService (enforcement versionado ADM-02).
 * - ReservationsModule: ReservationRepositoryPort, para crear la Reserva
 *   dentro de la misma transaccion de la conversion (caso de uso unico).
 * - PrismaModule/IdempotencyModule (@Global): TransactionManagerPort,
 *   ClockPort, IdempotencyInterceptor.
 * - FleetAvailabilityPort: adaptador REAL (`FleetModuleAvailabilityAdapter`)
 *   sobre el modulo Fleet real (FleetModule), in-process. RateCardPort
 *   sigue PROVISIONAL (revalidacion PR#7); ProvisionalQuotingGuard bloquea
 *   produccion mientras el tarifario lo sea, salvo
 *   KAIROS_ALLOW_PROVISIONAL_QUOTING=true.
 */
@Module({
  imports: [UsersModule, AuditModule, ReservationsModule, OutboxModule, ParametersModule, AuthorizationModule, FleetModule],
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
    { provide: FleetAvailabilityPort, useClass: FleetModuleAvailabilityAdapter },
    { provide: RateCardPort, useClass: ProvisionalRateCardAdapter },
    { provide: PROVISIONAL_QUOTING_POLICY, useFactory: () => provisionalQuotingPolicyFromEnv(process.env) },
  ],
})
export class InquiriesModule {}
