import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/persistence/prisma.service';
import { RetentionPurgePort, RetentionTarget } from '../application/retention-purge.port';

/**
 * SQL crudo (mismo criterio que OutboxRelayService: no depende de que `prisma generate` conozca columnas nuevas).
 *
 * Concurrencia: `DELETE ... WHERE id IN (SELECT ... LIMIT n FOR UPDATE SKIP LOCKED)` en UNA sentencia. Dos
 * instancias que purgan a la vez toman lotes disjuntos y nunca se bloquean ni se pisan. Se eligió esto en lugar de
 * un advisory lock porque (a) no necesita mantener una conexión/sesión dedicada (los locks de sesión se pierden o
 * se filtran con poolers tipo pgbouncer/Supabase), (b) un crash a mitad no deja ningún lock huérfano y (c) el
 * trabajo es idempotente: aunque dos réplicas corran, el resultado final es el mismo.
 */
@Injectable()
export class PrismaRetentionPurgeRepository extends RetentionPurgePort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async purgeBatch(target: RetentionTarget, cutoff: Date, limit: number): Promise<number> {
    switch (target) {
      case 'IDEMPOTENCY_KEYS':
        return this.prisma.$executeRaw`
          DELETE FROM "idempotency_keys" WHERE "id" IN (
            SELECT "id" FROM "idempotency_keys" WHERE "expires_at" < ${cutoff}
            ORDER BY "expires_at" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED)`;
      case 'OUTBOX_PROCESSED':
        return this.prisma.$executeRaw`
          DELETE FROM "outbox_events" WHERE "id" IN (
            SELECT "id" FROM "outbox_events" WHERE "processed_at" IS NOT NULL AND "processed_at" < ${cutoff}
            ORDER BY "processed_at" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED)`;
      case 'OUTBOX_DEAD_LETTER':
        return this.prisma.$executeRaw`
          DELETE FROM "outbox_events" WHERE "id" IN (
            SELECT "id" FROM "outbox_events" WHERE "dead_lettered_at" IS NOT NULL AND "dead_lettered_at" < ${cutoff}
            ORDER BY "dead_lettered_at" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED)`;
      case 'DASHBOARD_ITEMS_SEEN':
        // "Visto" = ya no sale en el tablero (dismissed_at no nulo). Un item NO visto (dismissed_at NULL) jamas entra en el DELETE.
        return this.prisma.$executeRaw`
          DELETE FROM "dashboard_items" WHERE "id" IN (
            SELECT "id" FROM "dashboard_items" WHERE "dismissed_at" IS NOT NULL AND "dismissed_at" < ${cutoff}
            ORDER BY "dismissed_at" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED)`;
    }
  }
}
