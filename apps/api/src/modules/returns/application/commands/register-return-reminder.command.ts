import { ReturnReminderResult } from '../../domain/return-reminder';

export class RegisterReturnReminderCommand {
  constructor(
    public readonly id: string,
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Versión del RECORDATORIO (reminder.version / If-Match), no la del expediente. */
    public readonly expectedVersion: number,
    public readonly result: ReturnReminderResult,
    public readonly sentAt?: Date,
    public readonly note?: string,
  ) {}
}
