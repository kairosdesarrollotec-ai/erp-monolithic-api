import { ReservationStatus } from '../../../domain/reservation-status';
import { ChannelMode } from '../../../domain/channel-mode';

/** TDD-RES-001.md seccion 11 - forma de respuesta HTTP de una reserva. */
export interface ReservationResponse {
  id: string;
  status: ReservationStatus;
  channelMode: ChannelMode;
  version: number;
  customer: { id: string; name: string };
  vehicle: { id: string; plate: string; label: string };
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
}
