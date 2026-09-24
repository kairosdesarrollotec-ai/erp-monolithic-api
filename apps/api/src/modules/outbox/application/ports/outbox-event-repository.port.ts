import type { Prisma } from '@prisma/client';

export interface PublishOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Puerto de escritura del outbox transaccional (TDD-KAIROS-TRANSVERSAL.md
 * 7.3, ADR-KAI-003 "APROBADA_ARQUITECTURA"): outbox_events es una tabla
 * transversal reutilizada por los 6 modulos - esta es su unica
 * implementacion de infraestructura, siguiendo el mismo patron que
 * AuditEventRepositoryPort (modulo audit).
 *
 * Hallazgo real de revision (23 sep 2026, revision de erp-api-local
 * contra el TDD): el modelo Prisma OutboxEvent ya existia desde el
 * schema baseline, pero ningun handler escribia en el (0 referencias a
 * "outbox" en todo src/). Sin esto no existe ningun evento real para que
 * el agregador transversal de TR-06/TR-07/TR-08 (Tablero, Notificaciones,
 * Sincronizacion) consuma - ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md en el Project.
 *
 * `tx` opcional, mismo criterio que AuditEventRepositoryPort: permite que
 * la publicacion del evento participe de la misma transaccion Serializable
 * que la mutacion que lo origina - un fallo al escribir el evento
 * revierte tambien la mutacion, evitando el mismo problema de atomicidad
 * que ya se corrigio para auditoria (hallazgo critico PR#6 "cambio de
 * estado y auditoria no son atomicos").
 */
export abstract class OutboxEventRepositoryPort {
  abstract publish(input: PublishOutboxEventInput, tx?: Prisma.TransactionClient): Promise<void>;
}
