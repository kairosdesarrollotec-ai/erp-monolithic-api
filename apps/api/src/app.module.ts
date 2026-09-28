import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { FleetModule } from './modules/fleet/fleet.module';
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
    FleetModule,
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
