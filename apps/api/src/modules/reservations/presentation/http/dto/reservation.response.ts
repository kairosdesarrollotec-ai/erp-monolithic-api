import { VehicleDataWarning } from '../../../../../common/domain/vehicle-data-warnings';
import { ReservationStatus } from '../../../domain/reservation-status';
import { ChannelMode } from '../../../domain/channel-mode';

export interface SaleResolutionResponse {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reason: string;
  offeredVehicle: { id: string; plate: string; label: string } | null;
  offerNote: string | null;
  flaggedAt: string;
  alternativeVehicleId: string | null;
  refundStatus: 'PENDING_TRANSFER' | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

/** TDD-RES-001.md seccion 11 - forma de respuesta HTTP de una reserva. */
export interface ReservationResponse {
  id: string;
  status: ReservationStatus;
  channelMode: ChannelMode;
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
  };
  missingRequirements: string[];
  confirmedAt: string | null;
  createdAt: string;
  /** RES-08: true si ya llego la fecha pactada (now >= startAt). El no-show NO es automatico (pendiente de Fiorella). */
  startDatePassed: boolean;
  /** RES-07: ultima resolucion por venta del vehiculo. Solo el detalle (GET /reservations/{id}) la incluye. */
  saleResolution?: SaleResolutionResponse | null;
}
