import type { Prisma } from '@prisma/client';
import type { IncidentScope } from './incident-repository.port';

export interface IncidentRentalRef {
  id: string;
}

export interface IncidentReturnRef {
  id: string;
  rentalId: string;
}

/**
 * Puerto de lectura de los expedientes a los que se liga una incidencia (Alquiler y, opcionalmente, Devolucion).
 * Solo expone existencia dentro del scope empresa/sede: Incidencias no depende de los modulos Rentals/Returns.
 */
export abstract class IncidentLinksPort {
  abstract findRental(rentalId: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentRentalRef | null>;
  abstract findReturn(returnId: string, scope: IncidentScope, tx?: Prisma.TransactionClient): Promise<IncidentReturnRef | null>;
}
