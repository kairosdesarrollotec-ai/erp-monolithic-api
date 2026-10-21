import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RentalsModule } from '../rentals/rentals.module';
import { FleetModule } from '../fleet/fleet.module';
import { SyncConflictsModule } from '../sync-conflicts/sync-conflicts.module';
import { ReturnsController } from './presentation/http/returns.controller';
import { ReturnEvidenceController } from './presentation/http/return-evidence.controller';
import { ReturnAccessService } from './application/services/return-access.service';
import { CreateReturnHandler } from './application/commands/create-return.handler';
import { ReceiveProvisionalHandler } from './application/commands/receive-provisional.handler';
import { RegisterReturnAlcoholTestHandler } from './application/commands/register-alcohol-test.handler';
import { ResolveAlcoholEscalationHandler } from './application/commands/resolve-alcohol-escalation.handler';
import { CompleteInspectionHandler } from './application/commands/complete-inspection.handler';
import { AssessDamageHandler } from './application/commands/assess-damage.handler';
import { ChargeImmobilizationHandler } from './application/commands/charge-immobilization.handler';
import { RegisterReturnLateChargeHandler } from './application/commands/register-late-charge.handler';
import { CloseFinancialHandler } from './application/commands/close-financial.handler';
import { CloseReturnHandler } from './application/commands/close-return.handler';
import { RequestReturnEvidenceUploadSessionHandler } from './application/commands/request-return-evidence-upload-session.handler';
import { RecordReturnEvidenceHandler } from './application/commands/record-return-evidence.handler';
import { DeleteReturnEvidenceHandler } from './application/commands/delete-return-evidence.handler';
import { GetReturnHandler } from './application/queries/get-return.handler';
import { GetCosmeticTariffHandler } from './application/queries/get-cosmetic-tariff.handler';
import { ListReturnsHandler } from './application/queries/list-returns.handler';
import { ListReturnEvidenceHandler } from './application/queries/list-return-evidence.handler';
import { ReturnRepositoryPort } from './application/ports/return-repository.port';
import { ReturnEvidenceStoragePort } from './application/ports/return-evidence-storage.port';
import { ReturnCustomerRiskPort } from './application/ports/return-customer-risk.port';
import { ReturnDepositSettlementPort } from './application/ports/return-deposit-settlement.port';
import { ReturnOpenIncidentsPort } from './application/ports/return-open-incidents.port';
import { PrismaReturnRepository } from './infrastructure/persistence/prisma-return.repository';
import { PrismaReturnDamagePersistence } from './infrastructure/persistence/prisma-return-damage.persistence';
import { PrismaImmobilizationChargePersistence } from './infrastructure/persistence/prisma-immobilization-charge.persistence';
import { PrismaReturnEvidencePersistence } from './infrastructure/persistence/prisma-return-evidence.persistence';
import { PrismaReturnCustomerRiskPersistence } from './infrastructure/persistence/prisma-return-customer-risk.persistence';
import { PrismaReturnDepositSettlementPersistence } from './infrastructure/persistence/prisma-return-deposit-settlement.persistence';
import { PrismaReturnOpenIncidentsPersistence } from './infrastructure/persistence/prisma-return-open-incidents.persistence';
import { GcsReturnEvidenceService } from './infrastructure/storage/gcs-return-evidence.service';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { GenerateDueReturnRemindersHandler } from './application/commands/generate-due-return-reminders.handler';
import { RegisterReturnReminderHandler } from './application/commands/register-return-reminder.handler';
import { ListReturnRemindersHandler } from './application/queries/list-return-reminders.handler';
import { ListReturnAlertsHandler } from './application/queries/list-return-alerts.handler';
import { ReturnReminderRepositoryPort } from './application/ports/return-reminder-repository.port';
import { ReturnAlertRepositoryPort } from './application/ports/return-alert-repository.port';
import { ReturnVehicleCommitmentPort } from './application/ports/return-vehicle-commitment.port';
import { PrismaReturnReminderPersistence } from './infrastructure/persistence/prisma-return-reminder.persistence';
import { PrismaReturnAlertPersistence } from './infrastructure/persistence/prisma-return-alert.persistence';
import { PrismaReturnVehicleCommitmentPersistence } from './infrastructure/persistence/prisma-return-vehicle-commitment.persistence';
import { ReturnReminderScheduler } from './infrastructure/scheduling/return-reminder.scheduler';
import { ReturnAlertScheduler } from './infrastructure/scheduling/return-alert.scheduler';
import { PublishReturnDashboardAlertsHandler } from './application/commands/publish-return-dashboard-alerts.handler';
import { ReturnDashboardAlertPort } from './application/ports/return-dashboard-alert.port';
import { ReturnAlertRecipientsPort } from './application/ports/return-alert-recipients.port';
import { MatrixReturnAlertRecipientsPersistence } from './infrastructure/persistence/matrix-return-alert-recipients.persistence';
import { PrismaReturnDashboardAlertPersistence } from './infrastructure/persistence/prisma-return-dashboard-alert.persistence';
import { GetResponsibilityTemplateHandler } from './application/queries/get-responsibility-template.handler';

/**
 * Módulo Devolución (DEV-01..10). Integra Rentals (RentalRepositoryPort: lectura y transición del alquiler),
 * Fleet (FleetVehicleRepositoryPort: estado del vehículo al cerrar), Audit y Outbox. PrismaModule (global)
 * aporta TransactionManagerPort y ClockPort; IdempotencyModule (global) el interceptor.
 * DocumentTemplatesModule provee la plantilla del documento de responsabilidad (PROP-015b).
 */
@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule, RentalsModule, FleetModule, DocumentTemplatesModule, SyncConflictsModule],
  controllers: [ReturnsController, ReturnEvidenceController],
  providers: [
    ReturnAccessService,
    CreateReturnHandler,
    ReceiveProvisionalHandler,
    RegisterReturnAlcoholTestHandler,
    ResolveAlcoholEscalationHandler,
    CompleteInspectionHandler,
    AssessDamageHandler,
    ChargeImmobilizationHandler,
    RegisterReturnLateChargeHandler,
    CloseFinancialHandler,
    CloseReturnHandler,
    RequestReturnEvidenceUploadSessionHandler,
    RecordReturnEvidenceHandler,
    DeleteReturnEvidenceHandler,
    GetReturnHandler,
    GetCosmeticTariffHandler,
    ListReturnsHandler,
    ListReturnEvidenceHandler,
    GetResponsibilityTemplateHandler,
    GenerateDueReturnRemindersHandler,
    RegisterReturnReminderHandler,
    ListReturnRemindersHandler,
    ListReturnAlertsHandler,
    ReturnReminderScheduler,
    PublishReturnDashboardAlertsHandler,
    ReturnAlertScheduler,
    PrismaReturnDamagePersistence,
    PrismaImmobilizationChargePersistence,
    PrismaReturnEvidencePersistence,
    { provide: ReturnRepositoryPort, useClass: PrismaReturnRepository },
    { provide: ReturnEvidenceStoragePort, useClass: GcsReturnEvidenceService },
    { provide: ReturnCustomerRiskPort, useClass: PrismaReturnCustomerRiskPersistence },
    { provide: ReturnDepositSettlementPort, useClass: PrismaReturnDepositSettlementPersistence },
    // DEV-09: incidencias ABIERTAS reales (tabla `incidents`, modulo Incidencias) bloquean close-financial y close.
    { provide: ReturnOpenIncidentsPort, useClass: PrismaReturnOpenIncidentsPersistence },
    // BR-DEV-004 (DEC-DEV-REMINDER-001): recordatorio 3 h antes, envío manual-asistido.
    { provide: ReturnReminderRepositoryPort, useClass: PrismaReturnReminderPersistence },
    // BR-DEV-001 / BR-DEV-011: alertas de garantía 24 h e inmovilización > 24 h (solo alerta).
    { provide: ReturnAlertRepositoryPort, useClass: PrismaReturnAlertPersistence },
    // DEC-DEVREM-002: proyección de la alerta de garantía de 24 h al tablero de Finanzas (dashboard_items).
    { provide: ReturnDashboardAlertPort, useClass: PrismaReturnDashboardAlertPersistence },
    { provide: ReturnAlertRecipientsPort, useClass: MatrixReturnAlertRecipientsPersistence },
    // DEC-DEV-COMMITMENT-001: libera el compromiso RENTAL del vehículo al cerrar la devolución.
    { provide: ReturnVehicleCommitmentPort, useClass: PrismaReturnVehicleCommitmentPersistence },
  ],
})
export class ReturnsModule {}
