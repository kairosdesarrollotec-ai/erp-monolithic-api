import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TransactionManagerPort } from '../application/ports/transaction-manager.port';

/** TDD-RES-001.md 10.3: reintentar transacciones abortadas por serializacion maximo dos veces, con jitter. */
export const MAX_SERIALIZATION_RETRIES = 2;

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

/**
 * Implementacion real de TransactionManagerPort, respaldada por
 * prisma.$transaction.
 *
 * Revalidacion PR#7 (conversion concurrente de la misma consulta): con
 * aislamiento Serializable, PostgreSQL aborta una de dos transacciones en
 * conflicto (Prisma P2034). Antes eso llegaba al cliente como 500. Ahora se
 * reintenta la transaccion completa hasta 2 veces con jitter (TDD-RES-001.md
 * 10.3) - en el reintento, las re-lecturas dentro de `work` ven el estado ya
 * confirmado por la ganadora y el handler responde con su error de negocio
 * (412/409/422). Si aun asi falla: 409 TRANSACTION_CONFLICT (recuperable).
 */
@Injectable()
export class PrismaTransactionManager implements TransactionManagerPort {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction((tx: Prisma.TransactionClient) => work(tx), options);
      } catch (error) {
        if (!isSerializationFailure(error)) {
          throw error;
        }
        if (attempt >= MAX_SERIALIZATION_RETRIES) {
          throw new ConflictException({
            code: 'TRANSACTION_CONFLICT',
            detail: 'La operacion entro en conflicto con otra operacion concurrente - reintenta.',
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 60)));
      }
    }
  }
}
