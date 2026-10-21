import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { SyncController } from './presentation/http/sync.controller';
import { SyncAccessService } from './application/services/sync-access.service';
import { SyncClosureGateService } from './application/services/sync-closure-gate.service';
import { SyncChecklistHandler } from './application/commands/sync-checklist.handler';
import { ResolveSyncConflictHandler } from './application/commands/resolve-sync-conflict.handler';
import { GetChecklistSyncStatusHandler } from './application/queries/get-checklist-sync-status.handler';
import { ListSyncConflictsHandler } from './application/queries/list-sync-conflicts.handler';
import { SyncStateRepositoryPort } from './application/ports/sync-state-repository.port';
import { SyncSourcePort } from './application/ports/sync-source.port';
import { SyncClosureGatePort } from './application/ports/sync-closure-gate.port';
import { PrismaSyncStateRepository } from './infrastructure/persistence/prisma-sync-state.repository';
import { PrismaSyncSourceAdapter } from './infrastructure/persistence/prisma-sync-source.adapter';

/**
 * TR-08 / SDD-KAIROS-TRANSVERSAL 17 - conflictos de sincronizacion offline (checklist de Entrega y de Recepcion).
 * No importa Rentals ni Returns (lee sus tablas solo en el adaptador de lectura, patron de los demas modulos);
 * exporta `SyncClosureGatePort` para que ellos bloqueen el cierre mientras haya conflictos abiertos.
 */
@Module({
  imports: [UsersModule, AuthorizationModule, AuditModule, OutboxModule],
  controllers: [SyncController],
  providers: [
    SyncAccessService,
    SyncChecklistHandler,
    ResolveSyncConflictHandler,
    GetChecklistSyncStatusHandler,
    ListSyncConflictsHandler,
    { provide: SyncStateRepositoryPort, useClass: PrismaSyncStateRepository },
    { provide: SyncSourcePort, useClass: PrismaSyncSourceAdapter },
    { provide: SyncClosureGatePort, useClass: SyncClosureGateService },
  ],
  exports: [SyncClosureGatePort],
})
export class SyncConflictsModule {}
