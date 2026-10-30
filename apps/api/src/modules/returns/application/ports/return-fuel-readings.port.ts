import type { Prisma } from '@prisma/client';
import type { ReturnScope } from './return-repository.port';

export interface ReturnFuelLineReadings {
  /** Líneas del RNC (Formato 06) registradas en la entrega del alquiler; null si no hay registro. */
  deliveryLines: number | null;
  /** Líneas del RNC registradas al devolver; null si no hay registro. */
  returnLines: number | null;
}

/**
 * Decisión de negocio 28-oct #1 (H-06): el combustible se compara entre lo que se entregó y lo que llega. Lee el último RNC
 * (FORMATO_06_RNC) del proceso RENTAL (entrega) y del proceso RETURN (devolución) del vehículo.
 */
export abstract class ReturnFuelReadingsPort {
  abstract findLines(
    input: { vehicleId: string; rentalId: string; returnId: string; scope: ReturnScope },
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnFuelLineReadings>;
}
