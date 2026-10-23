import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

/**
 * Russbel 22-oct-2026 (decision 1; DEC-CON-001-FINAL; BR-CON-003, EX-CON-001): `POST /reservations` YA NO CREA reservas.
 * La Consulta es el unico punto de entrada: la reserva se crea con
 * `POST /inquiries/{id}/commands/convert-to-reservation`. Este endpoint queda como compatibilidad y siempre responde
 * error (422 INQUIRY_REQUIRED sin `inquiryId`; 409 INQUIRY_CONVERSION_REQUIRED con `inquiryId`).
 *
 * El monto de reserva, la moneda y la version de politica ya NO se aceptan del cliente: los lee el servidor de la
 * politica ADM-03 (ReservationDepositPolicyPort). Los campos customerId/vehicleId/channelMode/startAt/endAt se aceptan
 * solo para no romper clientes antiguos y se ignoran.
 */
export class CreateReservationDto {
  @IsOptional() @IsUUID() inquiryId?: string;
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  /** DEPRECADO e ignorado. */
  @IsOptional() @IsUUID() customerId?: string;
  /** DEPRECADO e ignorado. */
  @IsOptional() @IsUUID() vehicleId?: string;
  /** DEPRECADO e ignorado. */
  @IsOptional() @IsIn(['PRESENCIAL', 'VIRTUAL']) channelMode?: 'PRESENCIAL' | 'VIRTUAL';
  /** DEPRECADO e ignorado. */
  @IsOptional() @IsISO8601() startAt?: string;
  /** DEPRECADO e ignorado. */
  @IsOptional() @IsISO8601() endAt?: string;
}
