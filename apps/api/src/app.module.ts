import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './modules/users/infrastructure/auth/firebase-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { CustomersModule } from './modules/customers/customers.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { HrAdministrationModule } from './modules/hr-administration/hr-administration.module';
import { AdminModule } from './modules/admin/admin.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { PrismaModule } from './common/persistence/prisma.module';
import { IdempotencyModule } from './common/http/idempotency.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // F8 — rate limiting global (OWASP A04/A05, TDD-00 §8.1):
    // - ttl: ventana de 60 segundos.
    // - limit: 120 peticiones por IP por ventana (endpoints autenticados).
    // El endpoint público POST /audit/login-attempts sobreescribe con @Throttle({ default: { limit: 10, ttl: 60000 } }).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IdempotencyModule,
    HealthModule,
    AuditModule,
    UsersModule,
    AuthorizationModule,
    ReservationsModule,
    InquiriesModule,
    CustomersModule,
    FleetModule,
    RentalsModule,
    ReturnsModule,
    IncidentsModule,
    RecruitmentModule,
    HrAdministrationModule,
    TemplatesModule,
    AdminModule,
    NotificationsModule,
  ],
  providers: [
    // Guard global de throttling: aplica a todos los endpoints.
    // Los endpoints que requieren un límite distinto usan @Throttle({ default: { limit, ttl } }).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guard global de autenticación Firebase (ADM-02): aplica a todos los endpoints excepto
    // los marcados con @Public() (/health y POST /audit/login-attempts).
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
})
export class AppModule {}
