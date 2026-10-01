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
import { RequestExtensionHandler } from './application/commands/request-extension.handler';
import { AuthorizeExtensionHandler } from './application/commands/authorize-extension.handler';
import { RejectExtensionHandler } from './application/commands/reject-extension.handler';
import { CreateContractTemplateHandler } from './application/commands/create-contract-template.handler';
import { GetRentalHandler } from './application/queries/get-rental.handler';
import { ListRentalsHandler } from './application/queries/list-rentals.handler';
import { ListContractTemplatesHandler } from './application/queries/list-contract-templates.handler';
import { RentalRepositoryPort } from './application/ports/rental-repository.port';
import { PrismaRentalRepository } from './infrastructure/persistence/prisma-rental.repository';
import { ContractTemplatesController } from './presentation/http/contract-templates.controller';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { FleetModule } from '../fleet/fleet.module';

@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule, FleetModule],
  controllers: [RentalsController, ContractTemplatesController],
  providers: [
    CreateRentalHandler,
    CreateRentalFromReservationHandler,
    ValidateDocumentsHandler,
    RegisterAlcoholTestHandler,
    EvaluateNotaryHandler,
    ApproveNotaryExceptionHandler,
    FormalizeContractHandler,
    CompleteDeliveryHandler,
    RequestExtensionHandler,
    AuthorizeExtensionHandler,
    RejectExtensionHandler,
    CreateContractTemplateHandler,
    GetRentalHandler,
    ListRentalsHandler,
    ListContractTemplatesHandler,
    { provide: RentalRepositoryPort, useClass: PrismaRentalRepository },
  ],
  exports: [RentalRepositoryPort],
})
export class RentalsModule {}
