import type { Prisma } from '@prisma/client';

/**
 * Compromiso de vehículo (`vehicle_commitments`, ver common/persistence/vehicle-overlap.ts). Al cerrar la
 * devolución el compromiso RENTAL del alquiler deja de bloquear la disponibilidad del vehículo.
 */
export abstract class ReturnVehicleCommitmentPort {
  /** Pasa a RELEASED el/los compromisos ACTIVE|CONSOLIDATED del alquiler. Idempotente. Devuelve cuántos liberó. */
  abstract releaseRentalCommitment(rentalId: string, organizationId: string, tx: Prisma.TransactionClient): Promise<number>;
}
