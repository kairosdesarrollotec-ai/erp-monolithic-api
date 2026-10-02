import { RentalEvidenceKind } from '../ports/rental-evidence-repository.port';

export class RecordEvidenceCommand {
  constructor(
    public readonly rentalId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: RentalEvidenceKind,
    public readonly zone: string,
    public readonly objectUrl: string,
  ) {}
}
