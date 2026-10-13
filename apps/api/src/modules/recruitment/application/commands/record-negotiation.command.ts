import { NegotiationOutcome } from '@prisma/client';

export class RecordNegotiationCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly candidateId: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly expectedVersion: number,
    public readonly outcome: NegotiationOutcome,
    public readonly offeredSalary: number,
    public readonly offeredSchedule?: string,
    public readonly offeredOtherConditions?: string,
    public readonly candidateSalary?: number,
    public readonly candidateSchedule?: string,
    public readonly candidateOtherConditions?: string,
    public readonly candidateStartDate?: Date,
    public readonly agreedSalary?: number,
    public readonly agreedConditions?: string,
    public readonly reason?: string,
  ) {}
}
