import type { Prisma } from '@prisma/client';

/**
 * Puerto para ejecutar una operacion dentro de una unica transaccion real
 * de base de datos.
 *
 * Hallazgo critico de revision PR#4 ("auditoria fuera de la transaccion"):
 * `SelectWorkContextHandler` hacia la validacion (lectura) y el registro
 * de auditoria (escritura) como 2 llamadas Prisma independientes, sin
 * ninguna garantia atomica entre ambas - un fallo de auditoria despues de
 * una validacion exitosa podia dejar una respuesta inconsistente con lo
 * realmente persistido.
 *
 * El tipo del contexto de transaccion se expone como `Prisma.TransactionClient`
 * (el mismo tipo que entrega `prisma.$transaction`) para que los puertos de
 * repositorio puedan aceptarlo y ejecutar sus queries dentro de la misma
 * transaccion - pero la capa de aplicacion (los handlers) solo conoce este
 * puerto, nunca `PrismaService` directamente (TDD-KAIROS-TRANSVERSAL.md
 * seccion 6: infrastructure/persistence es la unica capa que conoce
 * Prisma).
 */
export abstract class TransactionManagerPort {
  abstract run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}
