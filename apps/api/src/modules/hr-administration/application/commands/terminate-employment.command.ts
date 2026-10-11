import type { TerminationReason } from '@prisma/client';

export class TerminateEmploymentCommand {
  constructor(
    public readonly firebaseUid: string,
    public readonly employeeId: string,
    public readonly reason: TerminationReason,
    public readonly noticeDays: number,
    public readonly finalSettlementPaid: boolean,
    public readonly settlementAmount: number,
    public readonly notes?: string | null,
  ) {}
}
