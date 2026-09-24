import { InquiryResponse } from './inquiry.response';
import { ReservationResponse } from '../../../../reservations/presentation/http/dto/reservation.response';

/**
 * Hallazgo critico "convertir no crea reserva": la respuesta ahora
 * incluye la Reservation creada atomicamente junto con la Consulta ya
 * CONVERTIDA, para que el frontend nunca tenga que hacer una segunda
 * llamada (el punto de falla original del hallazgo).
 */
export interface ConvertToReservationResponse {
  inquiry: InquiryResponse;
  reservation: ReservationResponse;
}
