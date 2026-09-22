import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { IdempotencyPort, IdempotencyRecord, SaveIdempotencyRecordInput } from '../application/ports/idempotency.port';

@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { key },
      select: { requestHash: true, statusCode: true, responseBody: true, expiresAt: true },
    });
    if (!row) {
      return null;
    }
    // Clave vencida (TTL, ver IdempotencyInterceptor): se trata como si no
    // existiera - un reintento tardio ya no esta protegido, es una
    // solicitud nueva.
    if (row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { requestHash: row.requestHash, statusCode: row.statusCode, responseBody: row.responseBody };
  }

  async save(input: SaveIdempotencyRecordInput): Promise<void> {
    // `create` (no upsert): si dos requests concurrentes con la MISMA
    // clave llegan a la vez, ambas pasan el findByKey (todavia no existe
    // la fila) y ambas intentan crear - la restriccion unique sobre `key`
    // hace que la segunda falle con P2002 (violacion de unicidad), que se
    // ignora aqui a proposito: la primera en escribir gana, la segunda ya
    // hizo su trabajo de negocio (no se puede deshacer) pero al menos no
    // sobreescribe la respuesta cacheada de la primera.
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key: input.key,
          organizationId: input.organizationId,
          requestHash: input.requestHash,
          statusCode: input.statusCode,
          responseBody: input.responseBody as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + input.ttlMs),
        },
      });
    } catch (error) {
      if (!(error instanceof Object) || (error as { code?: string }).code !== 'P2002') {
        throw error;
      }
    }
  }
}
