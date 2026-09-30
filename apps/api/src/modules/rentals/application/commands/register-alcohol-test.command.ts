import { AlcoholTestResult } from '../../domain/alcohol-test-result';

export class RegisterAlcoholTestCommand {
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
