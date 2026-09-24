import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import {
  ClaimIdempotencyKeyInput,
  CompleteIdempotencyKeyInput,
  IdempotencyClaimResult,
  IdempotencyPort,
} from '../application/ports/idempotency.port';

const MAX_CLAIM_ATTEMPTS = 2;

@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyPort {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserva atomica: INSERT con `status_code = NULL` (en curso). La
   * restriccion UNIQUE de `key` garantiza que, entre N solicitudes
   * concurrentes con la misma clave, exactamente una inserta (CLAIMED) y
   * las demas reciben P2002 y leen el registro ganador.
   */
  async claim(input: ClaimIdempotencyKeyInput): Promise<IdempotencyClaimResult> {
    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
      try {
        await this.prisma.idempotencyKey.create({
          data: {
            key: input.key,
            organizationId: null,
            requestHash: input.requestHash,
            statusCode: null,
            responseBody: Prisma.JsonNull,
            expiresAt: new Date(Date.now() + input.ttlMs),
          },
        });
        return { status: 'CLAIMED' };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }

      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: input.key },
        select: { requestHash: true, statusCode: true, responseBody: true, expiresAt: true },
      });
      if (!existing) {
        continue; // se libero entre el INSERT y la lectura: reintentar la reserva
      }
      if (existing.expiresAt.getTime() < Date.now()) {
        // Clave vencida (TTL): se elimina de forma condicional y se reintenta
        // la reserva - un reintento tardio es una solicitud nueva.
        await this.prisma.idempotencyKey.deleteMany({
          where: { key: input.key, expiresAt: existing.expiresAt },
        });
        continue;
      }
      if (existing.requestHash !== input.requestHash) {
        return { status: 'MISMATCH' };
      }
      if (existing.statusCode === null) {
        return { status: 'IN_PROGRESS' };
      }
      return {
        status: 'REPLAY',
        record: {
          requestHash: existing.requestHash,
          statusCode: existing.statusCode,
          responseBody: existing.responseBody,
        },
      };
    }
    return { status: 'IN_PROGRESS' };
  }

  async complete(input: CompleteIdempotencyKeyInput): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key: input.key },
      data: {
        statusCode: input.statusCode,
        responseBody: input.responseBody as Prisma.InputJsonValue,
      },
    });
  }

  async release(key: string): Promise<void> {
    // Solo se libera una reserva todavia EN CURSO (status_code NULL): nunca
    // se borra una respuesta ya completada.
    await this.prisma.idempotencyKey.deleteMany({ where: { key, statusCode: null } });
  }
}
