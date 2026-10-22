export class EvaluateNotaryCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    /** DEC-ALQ-THIRDPATH-001: casilla de biometrico facial favorable que registra el personal (auditada). */
    public readonly biometricVerified: boolean = false,
  ) {}
}
