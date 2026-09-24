import { Global, Module } from '@nestjs/common';
import { IdempotencyPort } from '../application/ports/idempotency.port';
import { PrismaIdempotencyRepository } from '../persistence/prisma-idempotency.repository';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Antes (PR#6) IdempotencyPort/IdempotencyInterceptor se registraban solo
 * dentro de ReservationsModule. Consulta (PR#7) los necesita tambien - se
 * extraen a un modulo global unico en vez de duplicar el registro.
 */
@Global()
@Module({
  providers: [{ provide: IdempotencyPort, useClass: PrismaIdempotencyRepository }, IdempotencyInterceptor],
  exports: [IdempotencyPort, IdempotencyInterceptor],
})
export class IdempotencyModule {}
