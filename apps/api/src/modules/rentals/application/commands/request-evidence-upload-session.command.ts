import { RentalEvidenceContentType } from '../ports/rental-evidence-storage.port';
import { RentalEvidenceKind } from '../ports/rental-evidence-repository.port';

export class RequestEvidenceUploadSessionCommand {
  constructor(
    public readonly rentalId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: RentalEvidenceKind,
    public readonly zone: string,
    public readonly contentType: RentalEvidenceContentType,
    public readonly contentLength: number,
  ) {}
}
