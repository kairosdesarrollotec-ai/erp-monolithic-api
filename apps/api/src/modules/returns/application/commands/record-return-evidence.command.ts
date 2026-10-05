import { ReturnEvidenceType } from '../../domain/return-status';

export class RecordReturnEvidenceCommand {
  constructor(
    public readonly returnId: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly type: ReturnEvidenceType,
    public readonly zone: string,
    public readonly objectUrl: string,
  ) {}
}
