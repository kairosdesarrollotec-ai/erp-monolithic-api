import { InquiryResponse } from './inquiry.response';
import { RentalResponse } from '../../../../rentals/presentation/http/dto/rental.response';

/** Consulta ya CONVERTIDA + Alquiler DRAFT creado en la misma transaccion. */
export interface ConvertToRentalResponse {
  inquiry: InquiryResponse;
  rental: RentalResponse;
}
