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
 *
 * `options.isolationLevel` (hallazgo critico de revision PR#6, "cambio de
 * estado y auditoria no son atomicos" + reuso del nivel Serializable que
 * ConfirmReservationHandler necesita para el bloqueo atomico de vehiculo,
 * TDD-RES-001.md seccion 10.1): antes ese nivel de aislamiento solo se
 * podia pedir abriendo una transaccion Prisma directamente dentro del
 * repositorio (que por eso no podia incluir la auditoria). Exponerlo
 * aqui permite que un handler pida Serializable para todo su flujo
 * (autorizacion + lectura + mutacion + auditoria) sin que el repositorio
 * tenga que abrir su propia transaccion anidada.
 */
export abstract class TransactionManagerPort {
  abstract run<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
}
