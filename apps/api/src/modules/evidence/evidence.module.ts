import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { RentalsModule } from '../rentals/rentals.module';
import { ReturnsModule } from '../returns/returns.module';
import { EvidenceDeletionController } from './presentation/http/evidence-deletion.controller';
import { EvidenceAccessService } from './application/services/evidence-access.service';
import { EvidenceDeletionExpirationService } from './application/services/evidence-deletion-expiration.service';
import { RequestEvidenceDeletionHandler } from './application/commands/request-evidence-deletion.handler';
import { ApproveEvidenceDeletionHandler } from './application/commands/approve-evidence-deletion.handler';
import { RejectEvidenceDeletionHandler } from './application/commands/reject-evidence-deletion.handler';
import { ListEvidenceDeletionRequestsHandler } from './application/queries/list-evidence-deletion-requests.handler';
import { GetEvidenceDeletionRequestHandler } from './application/queries/get-evidence-deletion-request.handler';
import { EvidenceDeletionRequestRepositoryPort } from './application/ports/evidence-deletion-request-repository.port';
import { EvidenceDeletionTargetPort } from './application/ports/evidence-deletion-target.port';
import { PrismaEvidenceDeletionRequestRepository } from './infrastructure/persistence/prisma-evidence-deletion-request.repository';
import { RemovalServicesEvidenceDeletionTarget } from './infrastructure/persistence/prisma-evidence-deletion-target.adapter';
import { EvidenceDeletionExpiryScheduler } from './infrastructure/scheduling/evidence-deletion-expiry.scheduler';

/**
 * DEC-EVID-DELETE-002 (Respuestas 2026-10-20 #35, SDD-KAIROS-TRANSVERSAL 15.5) - eliminacion de evidencia con doble aprobacion.
 * La ejecucion reutiliza los servicios de remocion de Alquiler y Devolucion (exportados por sus modulos); este modulo solo
 * orquesta la solicitud, las dos aprobaciones, la auditoria y el vencimiento.
 */
@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, RentalsModule, ReturnsModule],
  controllers: [EvidenceDeletionController],
  providers: [
    EvidenceAccessService,
    EvidenceDeletionExpirationService,
    RequestEvidenceDeletionHandler,
    ApproveEvidenceDeletionHandler,
    RejectEvidenceDeletionHandler,
    ListEvidenceDeletionRequestsHandler,
    GetEvidenceDeletionRequestHandler,
    EvidenceDeletionExpiryScheduler,
    { provide: EvidenceDeletionRequestRepositoryPort, useClass: PrismaEvidenceDeletionRequestRepository },
    { provide: EvidenceDeletionTargetPort, useClass: RemovalServicesEvidenceDeletionTarget },
  ],
})
export class EvidenceModule {}
