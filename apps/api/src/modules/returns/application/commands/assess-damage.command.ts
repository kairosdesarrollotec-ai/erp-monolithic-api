import { DamageOrigin, DamageSeverity } from '../../domain/return-status';

export class AssessDamageCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly origin: DamageOrigin,
    public readonly severity: DamageSeverity,
    public readonly damagedZone?: string,
    public readonly estimatedAmount?: number,
    public readonly externalReportReference?: string,
    public readonly description?: string,
    public readonly customerAcceptsCost?: boolean,
  ) {}
}
