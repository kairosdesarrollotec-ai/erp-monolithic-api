import { AlcoholTestResult } from '../../domain/return-status';

export class RegisterReturnAlcoholTestCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly result: AlcoholTestResult,
    public readonly notes?: string,
  ) {}
}
