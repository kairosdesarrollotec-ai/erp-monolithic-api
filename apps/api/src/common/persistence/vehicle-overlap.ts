import type { Prisma } from '@prisma/client';
import { TERMINAL_RESERVATION_STATUSES } from '../../modules/reservations/domain/reservation-status';

/** Origen del conflicto de disponibilidad de un vehiculo. */
export type VehicleConflictSource = 'COMMITMENT' | 'RESERVATION';

export interface VehicleConflict {
  vehicleId: string;
  from: Date;
  to: Date;
  source: VehicleConflictSource;
}

export interface VehicleOverlapOptions {
  /** Reserva a ignorar (p. ej. al revalidar la propia reserva). */
  excludeReservationId?: string;
}

/** Subconjunto del cliente Prisma (PrismaService o TransactionClient) que usa el helper. */
export type VehicleOverlapClient = Pick<Prisma.TransactionClient, 'vehicleCommitment' | 'reservation'>;

/** Estados de `vehicle_commitments` que bloquean el vehiculo (mismo criterio que ReservationRepository.confirm). */
export const BLOCKING_COMMITMENT_STATUSES = ['ACTIVE', 'CONSOLIDATED'] as const;

/**
 * Regla unica de solape de vehiculo [from, to): un vehiculo esta ocupado si
 * existe (a) un `vehicle_commitment` ACTIVE|CONSOLIDATED con
 * `startsAt < to AND endsAt > from`, o (b) una reserva NO terminal con
 * `startAt < to AND endAt > from`.
 *
 * Consulta en lote (una query por fuente con `vehicleId in [...]`) y devuelve,
 * por vehiculo, el primer conflicto (los compromisos tienen prioridad sobre
 * las reservas). Los vehiculos sin conflicto no aparecen en el mapa.
 */
export async function findVehicleConflicts(
  client: VehicleOverlapClient,
  vehicleIds: readonly string[],
  from: Date,
  to: Date,
  options: VehicleOverlapOptions = {},
): Promise<Map<string, VehicleConflict>> {
  const conflicts = new Map<string, VehicleConflict>();
  if (vehicleIds.length === 0) return conflicts;
  const ids = Array.from(new Set(vehicleIds));

  const commitments = await client.vehicleCommitment.findMany({
    where: {
      vehicleId: { in: ids },
      status: { in: [...BLOCKING_COMMITMENT_STATUSES] },
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    select: { vehicleId: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: 'asc' },
  });
  for (const row of commitments) {
    if (!conflicts.has(row.vehicleId)) {
      conflicts.set(row.vehicleId, { vehicleId: row.vehicleId, from: row.startsAt, to: row.endsAt, source: 'COMMITMENT' });
    }
  }

  const pending = ids.filter((id) => !conflicts.has(id));
  if (pending.length === 0) return conflicts;

  const reservations = await client.reservation.findMany({
    where: {
      vehicleId: { in: pending },
      status: { notIn: Array.from(TERMINAL_RESERVATION_STATUSES) },
      startAt: { lt: to },
      endAt: { gt: from },
      ...(options.excludeReservationId ? { id: { not: options.excludeReservationId } } : {}),
    },
    select: { vehicleId: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
  for (const row of reservations) {
    if (!conflicts.has(row.vehicleId)) {
      conflicts.set(row.vehicleId, { vehicleId: row.vehicleId, from: row.startAt, to: row.endAt, source: 'RESERVATION' });
    }
  }
  return conflicts;
}

/** Primer conflicto de un solo vehiculo, o null si esta libre en [from, to). */
export async function findFirstVehicleConflict(
  client: VehicleOverlapClient,
  vehicleId: string,
  from: Date,
  to: Date,
  options: VehicleOverlapOptions = {},
): Promise<VehicleConflict | null> {
  const map = await findVehicleConflicts(client, [vehicleId], from, to, options);
  return map.get(vehicleId) ?? null;
}

/** dd/mm/yyyy (UTC, consistente con campos @db.Date y timestamps almacenados en UTC). */
export function formatDateDMY(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}
