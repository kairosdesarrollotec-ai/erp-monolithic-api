import type { Prisma } from '@prisma/client';
import type { ReturnZoneMarkRecord, ReturnZoneMarkValue } from '../../domain/return-zone-marks';

/** DEV-05 / PD-07: marcas por zona persistidas en el servidor (una fila por devolucion y zona). */
export abstract class ReturnZoneMarkRepositoryPort {
  abstract list(returnId: string, tx?: Prisma.TransactionClient): Promise<ReturnZoneMarkRecord[]>;

  /** Crea o actualiza las marcas indicadas (upsert por devolucion+zona). */
  abstract upsertMany(
    input: { returnId: string; marks: ReadonlyArray<{ zone: string; mark: ReturnZoneMarkValue }>; markedBy: string; markedAt: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
