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
    public readonly identityVerified?: boolean,
    public readonly identityDocumentType?: string,
    public readonly identityDocumentNumber?: string,
    public readonly identityMatchesHolder?: boolean,
    public readonly identityResult?: 'CONFORME' | 'NO_CONFORME',
    public readonly observation?: string,
  ) {}
}
