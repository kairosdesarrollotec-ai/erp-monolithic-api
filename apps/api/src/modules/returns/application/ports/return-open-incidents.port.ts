import type { Prisma } from '@prisma/client';
import type { ReturnScope } from './return-repository.port';

/**
 * DEV-09 / DR-DEV-001 / NFR-KAI-008 - "no se libera la garantia ni se cierra la devolucion con una incidencia
 * abierta". Puerto hacia el modulo Incidencias: devuelve las incidencias ABIERTAS reales ligadas al alquiler (o a
 * la devolucion) del expediente. CERRADA y VIA_LEGAL no bloquean. Se consulta dentro de la transaccion del comando.
 */
export abstract class ReturnOpenIncidentsPort {
  abstract findOpenIncidentIds(
    input: { rentalId: string; returnId: string; scope: ReturnScope },
    tx?: Prisma.TransactionClient,
  ): Promise<string[]>;
}
