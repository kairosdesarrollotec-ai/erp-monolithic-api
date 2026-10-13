import { Prisma } from '@prisma/client';
import { ReservationRecord } from '../../application/ports/reservation-repository.port';

/**
 * Hallazgo MEDIO de revision PR#6 ("as unknown as ocultan la
 * verificacion real del cliente Prisma"), mismo motivo y mismo fix que
 * ya se aplico en PrismaWorkContextRepository (PR#5, 12fc688): se
 * confirmo que `npx prisma generate` funciona en la Terminal real del
 * usuario y que el CI lo corre en cada build/test, asi que el cliente
 * tipado real esta disponible - se eliminan los `as unknown as` de este
 * archivo y se usan los tipos que Prisma genera con
 * `Prisma.ReservationGetPayload`, que SI falla en build si el
 * select/include deja de coincidir con el shape usado abajo.
 */
export type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: { customer: true; vehicle: true };
}>;

export function toReservationRecord(row: ReservationWithRelations): ReservationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    operatingCompanyId: row.operatingCompanyId,
    branchId: row.branchId,
    inquiryId: row.inquiryId,
    customerId: row.customerId,
    customerName: row.customer.fullName,
    vehicleId: row.vehicleId,
    vehiclePlate: row.vehicle.plate,
    vehicleLabel: `${row.vehicle.brand} ${row.vehicle.model} - ${row.vehicle.plate}`,
    status: row.status,
    channelMode: row.channelMode,
    startAt: row.startAt,
    endAt: row.endAt,
    requiredPaymentAmount: row.requiredPaymentAmount.toString(),
    currency: row.currency,
    paymentPolicyVersion: row.paymentPolicyVersion,
    paymentValidatedAt: row.paymentValidatedAt,
    documentsCompletedAt: row.documentsCompletedAt,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    version: row.version,
  };
}

/** `include` comun para leer una reserva con su cliente y vehiculo. */
export const RESERVATION_INCLUDE = { customer: true, vehicle: true } as const;
