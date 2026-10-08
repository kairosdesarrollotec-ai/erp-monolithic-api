import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RentalsModule } from '../rentals/rentals.module';
import { FleetModule } from '../fleet/fleet.module';
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
import { CloseFinancialHandler } from './application/commands/close-financial.handler';
import { CloseReturnHandler } from './application/commands/close-return.handler';
import { RequestReturnEvidenceUploadSessionHandler } from './application/commands/request-return-evidence-upload-session.handler';
import { RecordReturnEvidenceHandler } from './application/commands/record-return-evidence.handler';
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
import { GetResponsibilityTemplateHandler } from './application/queries/get-responsibility-template.handler';

/**
 * Módulo Devolución (DEV-01..10). Integra Rentals (RentalRepositoryPort: lectura y transición del alquiler),
 * Fleet (FleetVehicleRepositoryPort: estado del vehículo al cerrar), Audit y Outbox. PrismaModule (global)
 * aporta TransactionManagerPort y ClockPort; IdempotencyModule (global) el interceptor.
 * DocumentTemplatesModule provee la plantilla del documento de responsabilidad (PROP-015b).
 */
@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule, RentalsModule, FleetModule, DocumentTemplatesModule],
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
    CloseFinancialHandler,
    CloseReturnHandler,
    RequestReturnEvidenceUploadSessionHandler,
    RecordReturnEvidenceHandler,
    GetReturnHandler,
    GetCosmeticTariffHandler,
    ListReturnsHandler,
    ListReturnEvidenceHandler,
    GetResponsibilityTemplateHandler,
    PrismaReturnDamagePersistence,
    PrismaImmobilizationChargePersistence,
    PrismaReturnEvidencePersistence,
    { provide: ReturnRepositoryPort, useClass: PrismaReturnRepository },
    { provide: ReturnEvidenceStoragePort, useClass: GcsReturnEvidenceService },
    { provide: ReturnCustomerRiskPort, useClass: PrismaReturnCustomerRiskPersistence },
    { provide: ReturnDepositSettlementPort, useClass: PrismaReturnDepositSettlementPersistence },
    // DEV-09: incidencias ABIERTAS reales (tabla `incidents`, modulo Incidencias) bloquean close-financial y close.
    { provide: ReturnOpenIncidentsPort, useClass: PrismaReturnOpenIncidentsPersistence },
  ],
})
export class ReturnsModule {}
