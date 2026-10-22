import { ReservationRecord } from '../../application/ports/reservation-repository.port';
import { ReservationResponse, SaleResolutionResponse } from './dto/reservation.response';
import type { ReservationSaleResolutionRecord } from '../../domain/reservation-sale-resolution';

export interface ReservationResponseExtras {
  /** Solo el detalle la carga; `undefined` = no se consulto (la clave se omite), `null` = nunca hubo venta. */
  saleResolution?: ReservationSaleResolutionRecord | null;
  now?: Date;
}

export function toSaleResolutionResponse(record: ReservationSaleResolutionRecord): SaleResolutionResponse {
  return {
    id: record.id,
    status: record.status,
    reason: record.reason,
    offeredVehicle: record.offeredVehicle,
    offerNote: record.offerNote,
    flaggedAt: record.flaggedAt.toISOString(),
    alternativeVehicleId: record.alternativeVehicleId,
    refundStatus: record.refundStatus,
    resolutionNote: record.resolutionNote,
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
  };
}

export function toReservationResponse(record: ReservationRecord, extras: ReservationResponseExtras = {}): ReservationResponse {
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
    vehicleWarnings: record.vehicleWarnings ?? [],
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    requiredPayment: { amount: record.requiredPaymentAmount, currency: record.currency },
    requirements: {
      paymentValidatedAt: record.paymentValidatedAt ? record.paymentValidatedAt.toISOString() : null,
      documentsCompletedAt: record.documentsCompletedAt ? record.documentsCompletedAt.toISOString() : null,
    },
    missingRequirements,
    payment: record.payment
      ? {
          amount: record.payment.amount,
          method: record.payment.method,
          operationNumber: record.payment.operationNumber,
          payerName: record.payment.payerName,
          voucherDocumentId: record.payment.voucherDocumentId,
          registeredBy: record.payment.registeredBy,
        }
      : null,
    confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    startDatePassed: (extras.now ?? new Date()).getTime() >= record.startAt.getTime(),
    ...(extras.saleResolution === undefined
      ? {}
      : { saleResolution: extras.saleResolution ? toSaleResolutionResponse(extras.saleResolution) : null }),
  };
}
