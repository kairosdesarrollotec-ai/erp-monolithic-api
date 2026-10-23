import type { PaymentMethod } from '../../domain/reservation-payment-method';

export class RegisterPaymentCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** Monto realmente pagado ("350.00"). El monto REQUERIDO y la version de politica los lee el servidor. */
    public readonly amount: string,
    public readonly method: PaymentMethod,
    public readonly payerName: string,
    public readonly operationNumber?: string,
    public readonly voucherDocumentId?: string,
  ) {}
}
