import { ChannelMode } from '../../domain/channel-mode';

export class CreateReservationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly inquiryId: string,
    public readonly customerId: string,
    public readonly vehicleId: string,
    public readonly channelMode: ChannelMode,
    public readonly startAt: Date,
    public readonly endAt: Date,
  ) {}
}
