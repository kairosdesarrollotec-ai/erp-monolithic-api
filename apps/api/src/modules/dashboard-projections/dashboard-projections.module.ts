import { Module } from '@nestjs/common';
import { DashboardItemRepositoryPort } from './application/ports/dashboard-item-repository.port';
import { PrismaDashboardItemRepository } from './infrastructure/persistence/prisma-dashboard-item.repository';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';

/**
 * Modulo transversal de TR-06 (Tablero por rol). Ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md (Project KAIROS)
 * para el diseno completo del agregador; este modulo cubre la primera
 * porcion real (proyeccion de items de Reservations) - TR-07
 * (notificaciones) y TR-08 (sincronizacion) se agregan como modulos
 * hermanos cuando les toque, reutilizando el mismo outbox.
 */
@Module({
  providers: [
    { provide: DashboardItemRepositoryPort, useClass: PrismaDashboardItemRepository },
    OutboxRelayService,
  ],
  exports: [DashboardItemRepositoryPort],
})
export class DashboardProjectionsModule {}
