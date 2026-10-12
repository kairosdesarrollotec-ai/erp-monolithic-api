import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ReportingController } from './presentation/http/reporting.controller';
import { GetOperationalKpisHandler } from './application/queries/get-operational-kpis.handler';
import { GetFinancialKpisHandler } from './application/queries/get-financial-kpis.handler';
import { ExportReportHandler } from './application/queries/export-report.handler';

/**
 * Reportes (REP-01) — módulo de solo lectura.
 *
 * Sin entidades propias, sin migraciones (TDD-REP-001 §2.2).
 * Queries sobre tablas existentes: rentals, rental_deposits, rental_deposit_adjustments,
 * reservations, vehicles, returns, incidents.
 *
 * UsersModule aporta WorkContextAuthorizationService (validación empresa/sede del actor).
 * AuthorizationModule aporta MatrixAuthorizationService (permisos REPORT.* ADM-02).
 * PrismaModule es @Global — no requiere importación explícita.
 */
@Module({
  imports: [UsersModule, AuthorizationModule],
  controllers: [ReportingController],
  providers: [
    GetOperationalKpisHandler,
    GetFinancialKpisHandler,
    ExportReportHandler,
  ],
})
export class ReportingModule {}
