import { IsDecimal, IsIn, IsISO8601, IsInt, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

/**
 * CONFLICT-CON-001 (resuelto): inquiryId es opcional — se omite para
 * creacion directa, se incluye cuando la reserva se origina en una Consulta
 * (aunque en ese caso se recomienda usar convert-to-reservation que valida
 * la cotizacion vigente y transiciona la Consulta en la misma transaccion).
 */
export class CreateReservationDto {
  @IsOptional() @IsUUID() inquiryId?: string;
  @IsUUID() customerId!: string;
  @IsUUID() vehicleId!: string;
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;
  @IsIn(['PRESENCIAL', 'VIRTUAL']) channelMode!: 'PRESENCIAL' | 'VIRTUAL';
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  /** Monto a cobrar al confirmar (BR-RES-001). Formato: "300.00". */
  @IsString() @IsDecimal({ decimal_digits: '0,2' }) requiredPaymentAmount!: string;
  @IsString() currency!: string;
  @IsInt() @IsPositive() paymentPolicyVersion!: number;
}
