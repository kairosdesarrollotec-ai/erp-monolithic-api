import { ReturnFuelLevel } from '../../domain/return-status';

export class ReceiveProvisionalCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly rentalId: string,
    public readonly mileageAtReturn: number,
    public readonly fuelLevelAtReturn: ReturnFuelLevel,
    public readonly customerPresent?: boolean,
    public readonly notes?: string,
  ) {}
}
