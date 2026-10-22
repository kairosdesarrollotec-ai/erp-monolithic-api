/**
 * Decision 8 (Russbel 22-oct-2026): medios de pago aceptados para el pago de la reserva y de la garantia del alquiler
 * (BR-ALQ-011). Se verifican con el envio del comprobante.
 */
export const PAYMENT_METHODS = ['TRANSFERENCIA', 'DEPOSITO', 'PLIN', 'YAPE', 'EFECTIVO', 'POS'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PaymentProofInput {
  method: PaymentMethod;
  /** Nº de operacion (o nº de recibo si el pago es en EFECTIVO). */
  operationNumber?: string;
  payerName: string;
  /** Id del documento comprobante subido (reserva: ReservationDocument PAYMENT_VOUCHER; alquiler: RentalDocument PAYMENT_VOUCHER). */
  voucherDocumentId?: string;
}

/**
 * Regla propuesta (22-oct-2026, PROPUESTO): comprobante obligatorio para todos los metodos; en EFECTIVO basta el nº de
 * recibo o el comprobante. Devuelve los datos faltantes (vacio = completo).
 */
export function missingPaymentProof(input: PaymentProofInput): string[] {
  const hasOperation = !!input.operationNumber && input.operationNumber.trim().length > 0;
  const hasVoucher = !!input.voucherDocumentId;
  if (input.method === 'EFECTIVO') {
    return hasOperation || hasVoucher ? [] : ['operationNumber (nº de recibo) o voucherDocumentId'];
  }
  const missing: string[] = [];
  if (!hasOperation) missing.push('operationNumber');
  if (!hasVoucher) missing.push('voucherDocumentId');
  return missing;
}
