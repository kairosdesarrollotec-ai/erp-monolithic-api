/**
 * Hallazgo ALTO de revision PR#6 ("idempotencia no implementada" -
 * TDD-RES-001.md seccion 15: "un reintento del mismo Idempotency-Key
 * nunca debe crear un segundo vehicle_commitment"). Puerto minimo para
 * que IdempotencyInterceptor pueda guardar/recuperar la respuesta
 * asociada a una clave, sin acoplarse a Prisma directamente.
 */
export interface IdempotencyRecord {
  requestHash: string;
  statusCode: number | null;
  responseBody: unknown;
}

export interface SaveIdempotencyRecordInput {
  key: string;
  organizationId: string | null;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  ttlMs: number;
}

export abstract class IdempotencyPort {
  abstract findByKey(key: string): Promise<IdempotencyRecord | null>;
  abstract save(input: SaveIdempotencyRecordInput): Promise<void>;
}
