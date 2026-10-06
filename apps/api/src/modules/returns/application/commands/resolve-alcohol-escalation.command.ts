import { AlcoholEscalationDecision } from '../../domain/return-status';

export class ResolveAlcoholEscalationCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly decision: AlcoholEscalationDecision,
    public readonly markCustomerRed: boolean,
    public readonly notes: string,
  ) {}
}
