import { ChannelMode } from '../../domain/channel-mode';

/**
 * CONFLICT-CON-001 (resuelto): inquiryId es opcional para el caso de
 * creacion directa sin consulta previa. Cuando se provee, el handler valida
 * que la consulta pertenezca a la empresa del contexto.
 */
export class CreateReservationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly customerId: string,
    public readonly vehicleId: string,
    public readonly channelMode: ChannelMode,
    public readonly startAt: Date,
    public readonly endAt: Date,
    public readonly requiredPaymentAmount: string,
    public readonly currency: string,
    public readonly paymentPolicyVersion: number,
    public readonly inquiryId?: string,
  ) {}
}
