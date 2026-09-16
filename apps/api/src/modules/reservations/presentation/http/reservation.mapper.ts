import { ReservationRecord } from '../../application/ports/reservation-repository.port';
import { ReservationResponse } from './dto/reservation.response';

export function toReservationResponse(record: ReservationRecord): ReservationResponse {
  const missingRequirements: string[] = [];
  if (!record.paymentValidatedAt) missingRequirements.push('PAYMENT_VALIDATION');
  if (!record.documentsCompletedAt) missingRequirements.push('DOCUMENTS_COMPLETE');

  return {
    id: record.id,
    status: record.status,
    channelMode: record.channelMode,
    version: record.version,
    customer: { id: record.customerId, name: record.customerName },
    vehicle: { id: record.vehicleId, plate: record.vehiclePlate, label: record.vehicleLabel },
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    requiredPayment: { amount: record.requiredPaymentAmount, currency: record.currency },
    requirements: {
      paymentValidatedAt: record.paymentValidatedAt ? record.paymentValidatedAt.toISOString() : null,
      documentsCompletedAt: record.documentsCompletedAt ? record.documentsCompletedAt.toISOString() : null,
    },
    missingRequirements,
    confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  };
}
