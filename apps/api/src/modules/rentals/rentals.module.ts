import { Module } from '@nestjs/common';
import { RentalsController } from './presentation/http/rentals.controller';
import { CreateRentalHandler } from './application/commands/create-rental.handler';
import { CreateRentalFromReservationHandler } from './application/commands/create-rental-from-reservation.handler';
import { ValidateDocumentsHandler } from './application/commands/validate-documents.handler';
import { RegisterAlcoholTestHandler } from './application/commands/register-alcohol-test.handler';
import { EvaluateNotaryHandler } from './application/commands/evaluate-notary.handler';
import { ApproveNotaryExceptionHandler } from './application/commands/approve-notary-exception.handler';
import { FormalizeContractHandler } from './application/commands/formalize-contract.handler';
import { CompleteDeliveryHandler } from './application/commands/complete-delivery.handler';
import { RequestEvidenceUploadSessionHandler } from './application/commands/request-evidence-upload-session.handler';
import { RecordEvidenceHandler } from './application/commands/record-evidence.handler';
import { ListRentalEvidenceHandler } from './application/queries/list-rental-evidence.handler';
import { RequestExtensionHandler } from './application/commands/request-extension.handler';
import { AuthorizeExtensionHandler } from './application/commands/authorize-extension.handler';
import { RejectExtensionHandler } from './application/commands/reject-extension.handler';
import { CreateContractTemplateHandler } from './application/commands/create-contract-template.handler';
import { ReportExtensionBreachHandler } from './application/commands/report-extension-breach.handler';
import { GetRentalHandler } from './application/queries/get-rental.handler';
import { ListRentalsHandler } from './application/queries/list-rentals.handler';
import { ListContractTemplatesHandler } from './application/queries/list-contract-templates.handler';
import { RentalRepositoryPort } from './application/ports/rental-repository.port';
import { RentalEvidenceRepositoryPort } from './application/ports/rental-evidence-repository.port';
import { RentalEvidenceStoragePort } from './application/ports/rental-evidence-storage.port';
import { PrismaRentalRepository } from './infrastructure/persistence/prisma-rental.repository';
import { PrismaContractTemplatePersistence } from './infrastructure/persistence/prisma-contract-template.persistence';
import { PrismaRentalExtensionPersistence } from './infrastructure/persistence/prisma-rental-extension.persistence';
import { PrismaRentalNotaryContractPersistence } from './infrastructure/persistence/prisma-rental-notary-contract.persistence';
import { ContractTemplatesController } from './presentation/http/contract-templates.controller';
import { PrismaRentalEvidenceRepository } from './infrastructure/persistence/prisma-rental-evidence.repository';
import { GcsRentalEvidenceService } from './infrastructure/storage/gcs-rental-evidence.service';
import { RequestRentalDocumentUploadSessionHandler } from './application/commands/request-rental-document-upload-session.handler';
import { RecordRentalDocumentHandler } from './application/commands/record-rental-document.handler';
import { ListRentalDocumentsHandler } from './application/queries/list-rental-documents.handler';
import { RentalDocumentRepositoryPort } from './application/ports/rental-document-repository.port';
import { RentalDocumentStoragePort } from './application/ports/rental-document-storage.port';
import { PrismaRentalDocumentRepository } from './infrastructure/persistence/prisma-rental-document.repository';
import { GcsRentalDocumentService } from './infrastructure/storage/gcs-rental-document.service';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { FleetModule } from '../fleet/fleet.module';
import { RentalCreationGuard } from './application/services/rental-creation.guard';
import { RentalDocumentsController } from './presentation/http/rental-documents.controller';

@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule, FleetModule],
  controllers: [ContractTemplatesController, RentalsController, RentalDocumentsController],
  providers: [
    CreateRentalHandler,
    CreateRentalFromReservationHandler,
    ValidateDocumentsHandler,
    RegisterAlcoholTestHandler,
    EvaluateNotaryHandler,
    ApproveNotaryExceptionHandler,
    FormalizeContractHandler,
    CompleteDeliveryHandler,
    RequestEvidenceUploadSessionHandler,
    RecordEvidenceHandler,
    ListRentalEvidenceHandler,
    RequestExtensionHandler,
    AuthorizeExtensionHandler,
    RejectExtensionHandler,
    CreateContractTemplateHandler,
    ReportExtensionBreachHandler,
    GetRentalHandler,
    ListRentalsHandler,
    ListContractTemplatesHandler,
    PrismaContractTemplatePersistence,
    PrismaRentalExtensionPersistence,
    PrismaRentalNotaryContractPersistence,
    RequestRentalDocumentUploadSessionHandler,
    RecordRentalDocumentHandler,
    ListRentalDocumentsHandler,
    RentalCreationGuard,
    { provide: RentalRepositoryPort, useClass: PrismaRentalRepository },
    { provide: RentalEvidenceRepositoryPort, useClass: PrismaRentalEvidenceRepository },
    { provide: RentalEvidenceStoragePort, useClass: GcsRentalEvidenceService },
    { provide: RentalDocumentRepositoryPort, useClass: PrismaRentalDocumentRepository },
    { provide: RentalDocumentStoragePort, useClass: GcsRentalDocumentService },
  ],
  exports: [RentalRepositoryPort, RentalCreationGuard],
})
export class RentalsModule {}
