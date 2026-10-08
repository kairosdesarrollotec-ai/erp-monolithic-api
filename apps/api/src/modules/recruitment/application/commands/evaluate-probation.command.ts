export class EvaluateProbationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly passed: boolean,
    public readonly qualitativeEvaluation: string,
  ) {}
}
