import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IncidentsController } from './presentation/http/incidents.controller';
import { IncidentAccessService } from './application/services/incident-access.service';
import { IncidentTransitionService } from './application/services/incident-transition.service';
import { CreateIncidentHandler } from './application/commands/create-incident.handler';
import { AddIncidentActionHandler } from './application/commands/add-incident-action.handler';
import { ResolveIncidentHandler } from './application/commands/resolve-incident.handler';
import { CloseIncidentHandler } from './application/commands/close-incident.handler';
import { ReferIncidentToLegalHandler } from './application/commands/refer-incident-to-legal.handler';
import { GetIncidentHandler } from './application/queries/get-incident.handler';
import { ListIncidentsHandler } from './application/queries/list-incidents.handler';
import { IncidentRepositoryPort } from './application/ports/incident-repository.port';
import { IncidentLinksPort } from './application/ports/incident-links.port';
import { PrismaIncidentRepository } from './infrastructure/persistence/prisma-incident.repository';
import { PrismaIncidentLinksAdapter } from './infrastructure/persistence/prisma-incident-links.adapter';

/**
 * Incidencias (INC-01/INC-02). UsersModule aporta WorkContextAuthorizationService (contexto empresa/sede) y
 * AuthorizationModule la matriz versionada (modulo INCIDENT, ADM-02). Audit/Outbox para el registro transaccional.
 * PrismaModule/IdempotencyModule (@Global) aportan TransactionManagerPort, ClockPort e IdempotencyInterceptor.
 * La conexion con Devolucion (INCIDENT_STILL_OPEN) vive del lado de Returns: ReturnOpenIncidentsPort lee la tabla
 * `incidents`, de modo que no hay dependencia circular entre modulos.
 */
@Module({
  imports: [UsersModule, AuditModule, OutboxModule, AuthorizationModule],
  controllers: [IncidentsController],
  providers: [
    IncidentAccessService,
    IncidentTransitionService,
    CreateIncidentHandler,
    AddIncidentActionHandler,
    ResolveIncidentHandler,
    CloseIncidentHandler,
    ReferIncidentToLegalHandler,
    GetIncidentHandler,
    ListIncidentsHandler,
    { provide: IncidentRepositoryPort, useClass: PrismaIncidentRepository },
    { provide: IncidentLinksPort, useClass: PrismaIncidentLinksAdapter },
  ],
})
export class IncidentsModule {}
