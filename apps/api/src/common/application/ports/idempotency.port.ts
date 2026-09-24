/**
 * Deduplicacion de comandos idempotentes (TDD-KAIROS-TRANSVERSAL.md 7.3,
 * TDD-RES-001.md seccion 15, TDD-CON-001.md seccion 15).
 *
 * Hallazgo ALTO de revalidacion PR#7 ("reintentos pueden duplicar
 * efectos" - deduplicacion transaccional): la version anterior (PR#6)
 * hacia `findByKey` -> ejecutar -> `save`. Dos solicitudes concurrentes
 * con la MISMA clave pasaban ambas el `findByKey` y AMBAS ejecutaban el
 * comando. Ahora la clave se RESERVA atomicamente ANTES de ejecutar
 * (`claim`, respaldado por la restriccion UNIQUE de
 * `idempotency_keys.key`): solo una solicitud gana la reserva; la otra
 * recibe la respuesta ya guardada, o 409 si la primera sigue en curso.
 */
export interface IdempotencyRecord {
  requestHash: string;
  statusCode: number | null;
  responseBody: unknown;
}

export type IdempotencyClaimResult =
  /** Clave nueva (o vencida): esta solicitud debe ejecutar el comando. */
  | { status: 'CLAIMED' }
  /** Misma clave y mismo contenido, ya completada: devolver la respuesta guardada. */
  | { status: 'REPLAY'; record: IdempotencyRecord }
  /** Misma clave y mismo contenido, todavia en ejecucion por otra solicitud. */
  | { status: 'IN_PROGRESS' }
  /** Misma clave con contenido DISTINTO: uso invalido del header. */
  | { status: 'MISMATCH' };

export interface ClaimIdempotencyKeyInput {
  key: string;
  requestHash: string;
  ttlMs: number;
}

export interface CompleteIdempotencyKeyInput {
  key: string;
  statusCode: number;
  responseBody: unknown;
}

export abstract class IdempotencyPort {
  abstract claim(input: ClaimIdempotencyKeyInput): Promise<IdempotencyClaimResult>;
  abstract complete(input: CompleteIdempotencyKeyInput): Promise<void>;
  /** Libera una reserva cuyo comando fallo, para que el cliente pueda reintentar. */
  abstract release(key: string): Promise<void>;
}
