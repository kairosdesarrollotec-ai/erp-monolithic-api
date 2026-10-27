import { VehicleDataWarning } from '../../../../../common/domain/vehicle-data-warnings';
import { ReservationStatus } from '../../../domain/reservation-status';
import { ChannelMode, CustomerLocation } from '../../../domain/channel-mode';

export interface SaleResolutionResponse {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reason: string;
  offeredVehicle: { id: string; plate: string; label: string } | null;
  offerNote: string | null;
  flaggedAt: string;
  alternativeVehicleId: string | null;
  refundStatus: 'PENDING_TRANSFER' | 'TRANSFERRED' | null;
  transferVoucher?: string | null;
  transferredAt?: string | null;
  transferredBy?: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface ReservationPaymentResponse {
  amount: string;
  method: 'TRANSFERENCIA' | 'DEPOSITO' | 'PLIN' | 'YAPE' | 'EFECTIVO' | 'POS';
  operationNumber: string | null;
  payerName: string;
  voucherDocumentId: string | null;
  registeredBy: string | null;
}

export interface ReservationReminderResponse {
  id: string;
  reservationId: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  dueAt: string;
  messageText: string;
  generatedAt: string;
  sentAt: string | null;
  sentBy: string | null;
  resultNote: string | null;
  attempts: number;
}

export interface AirportServiceResponse {
  id: string;
  targetType: 'RESERVATION' | 'RENTAL';
  targetId: string;
  scheduledAt: string;
  location: string;
  additionalAmount: string;
  notes: string | null;
  registeredBy: string;
  createdAt: string;
}

/** TDD-RES-001.md seccion 11 - forma de respuesta HTTP de una reserva. */
export interface ReservationResponse {
  id: string;
  status: ReservationStatus;
  channelMode: ChannelMode;
  /** BR-RES-005: si el cliente puede acercarse a la oficina (null en reservas creadas sin este dato). */
  canComeToOffice: boolean | null;
  /** DAT-RES-001: ubicacion declarada del cliente al momento de la reserva (null en reservas creadas sin este dato). */
  customerLocation: CustomerLocation | null;
  version: number;
  customer: { id: string; name: string };
  vehicle: { id: string; plate: string; label: string };
  /** DEC-ALQ-VEHDATA-001: un aviso por cada dato del vehiculo que falta (capacidad, garantia, combustible). No bloquea. */
  vehicleWarnings: VehicleDataWarning[];
  startAt: string;
  endAt: string;
  requiredPayment: { amount: string; currency: string };
  requirements: {
    paymentValidatedAt: string | null;
    documentsCompletedAt: string | null;
    isRemote?: boolean;
    video360Uploaded?: boolean;
    signedAcceptanceUploaded?: boolean;
  };
  missingRequirements: string[];
  /** Decision 8: comprobante del pago registrado (null si aun no se registro). */
  payment: ReservationPaymentResponse | null;
  confirmedAt: string | null;
  createdAt: string;
  /** RES-08: true si ya llego la fecha pactada (now >= startAt). El no-show NO es automatico (pendiente de Fiorella). */
  startDatePassed: boolean;
  /** RES-07: ultima resolucion por venta del vehiculo. Solo el detalle (GET /reservations/{id}) la incluye. */
  saleResolution?: SaleResolutionResponse | null;
  /** C3: Estado del recordatorio 3 h antes del recojo (null si aún no se ha registrado). */
  reminder?: ReservationReminderResponse | null;
  /** C1: Solicitud de servicio de aeropuerto si existe para esta reserva. */
  airportService?: AirportServiceResponse | null;
}
