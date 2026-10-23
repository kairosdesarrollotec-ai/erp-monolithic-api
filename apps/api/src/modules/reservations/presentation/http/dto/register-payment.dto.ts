import { IsDecimal, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PAYMENT_METHODS, PaymentMethod } from '../../../domain/reservation-payment-method';

/**
 * Decision 8 (Russbel 22-oct-2026): registrar el pago de la reserva con su comprobante. El monto requerido y la version
 * de politica los lee el servidor (no se aceptan del cliente); `amount` es lo realmente pagado.
 */
export class RegisterPaymentDto {
  @IsUUID() companyId!: string;
  @IsUUID() branchId!: string;

  /** Monto pagado, formato "350.00". Debe ser igual al monto de la reserva (menor -> 422 INVALID_DEPOSIT_AMOUNT). */
  @IsString() @IsDecimal({ decimal_digits: '0,2' }) amount!: string;

  @IsIn(PAYMENT_METHODS) method!: PaymentMethod;

  /** Nº de operacion bancaria / billetera; en EFECTIVO, nº de recibo. */
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) operationNumber?: string;

  @IsString() @IsNotEmpty() @MaxLength(120) payerName!: string;

  /** Id del documento PAYMENT_VOUCHER ya subido a la reserva (POST /reservations/{id}/documents). */
  @IsOptional() @IsUUID() voucherDocumentId?: string;
}
