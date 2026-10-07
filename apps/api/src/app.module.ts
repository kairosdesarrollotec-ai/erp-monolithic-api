import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { PrismaModule } from './common/persistence/prisma.module';
import { IdempotencyModule } from './common/http/idempotency.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
