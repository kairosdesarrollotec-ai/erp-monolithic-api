import { Module } from '@nestjs/common';
import { OutboxEventRepositoryPort } from './application/ports/outbox-event-repository.port';
import { PrismaOutboxEventRepository } from './infrastructure/persistence/prisma-outbox-event.repository';

/**
 * Modulo transversal (TDD-KAIROS-TRANSVERSAL.md 7.3) - outbox_events se
 * reutiliza desde los modulos de dominio que publican eventos (Reservations,
 * Inquiries en la conversion, y a futuro Rentals/Returns/Recruitment/
 * HR-Administration), igual que AuditModule para audit_events. No expone
 * controller propio: el consumo del outbox es tarea de un worker separado
 * (apps/worker, todavia no construido - ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md en el Project).
 */
@Module({
  providers: [{ provide: OutboxEventRepositoryPort, useClass: PrismaOutboxEventRepository }],
  exports: [OutboxEventRepositoryPort],
})
export class OutboxModule {}
