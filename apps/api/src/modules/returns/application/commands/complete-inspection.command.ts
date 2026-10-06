import { ResponsibilityDocumentInput } from '../../domain/responsibility-document';

export class CompleteInspectionCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly hasDamages: boolean,
    public readonly damagesDescription?: string,
    public readonly notes?: string,
    /** Obligatorio: si falta, el handler responde MISSING_RESPONSIBILITY_DOCUMENT (422). */
    public readonly responsibilityDocument?: ResponsibilityDocumentInput,
  ) {}
}
