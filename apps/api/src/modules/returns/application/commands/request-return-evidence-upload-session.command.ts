import { ReturnEvidenceType } from '../../domain/return-status';
import { ReturnEvidenceContentType } from '../ports/return-evidence-storage.port';

export class RequestReturnEvidenceUploadSessionCommand {
  constructor(
    public readonly returnId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: ReturnEvidenceType,
    public readonly zone: string,
    public readonly contentType: ReturnEvidenceContentType,
    public readonly contentLength: number,
  ) {}
}
