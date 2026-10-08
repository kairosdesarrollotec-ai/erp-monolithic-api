export class CompleteOnboardingCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly startDate: Date,
    public readonly inductionScheduled: boolean,
    public readonly equipmentAssigned: boolean,
    public readonly responsibilityCardSigned: boolean,
    public readonly notarizedContractSigned: boolean = false,
  ) {}
}
