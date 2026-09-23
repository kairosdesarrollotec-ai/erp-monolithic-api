import { Module } from '@nestjs/common';
import { DashboardItemRepositoryPort } from './application/ports/dashboard-item-repository.port';
import { PrismaDashboardItemRepository } from './infrastructure/persistence/prisma-dashboard-item.repository';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';
import { NotificationReadModelModule } from '../notifications/notification-read-model.module';
import { NotificationTemplatesModule } from '../notification-templates/notification-templates.module';

/**
 * Modulo transversal de TR-06 (Tablero por rol). Ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md (Project KAIROS)
 * para el diseno completo del agregador.
 *
 * ALCANCE REAL (23 sep 2026): el diseno original propone un worker
 * separado por consumidor (uno para TR-06, otro para TR-07). Se opto
 * por NO hacerlo asi: `outbox_events.processedAt` es una sola columna
 * compartida sin cursor por consumidor (ver schema.prisma) - dos
 * relays independientes marcando el mismo `processedAt` se pisarian
 * entre si (el segundo nunca veria eventos que el primero ya marco).
 * Mientras esa limitacion exista, OutboxRelayService de este modulo
 * hace tambien la proyeccion de notificaciones de TR-07 en el mismo
 * ciclo, antes de marcar el evento como procesado - un solo consumidor,
 * multiples proyecciones. Revisar si se agrega un cursor por consumidor
 * antes de sumar TR-08 como tercera proyeccion sobre el mismo evento.
 */
@Module({
  imports: [NotificationReadModelModule, NotificationTemplatesModule],
  providers: [
    { provide: DashboardItemRepositoryPort, useClass: PrismaDashboardItemRepository },
    OutboxRelayService,
  ],
  exports: [DashboardItemRepositoryPort],
})
export class DashboardProjectionsModule {}
