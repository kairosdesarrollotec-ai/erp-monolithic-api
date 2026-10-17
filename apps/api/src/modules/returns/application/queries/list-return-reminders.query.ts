import { ReturnReminderStatus } from '../../domain/return-reminder';

export const RETURN_REMINDER_LIST_DEFAULT_LIMIT = 50;
export const RETURN_REMINDER_LIST_MAX_LIMIT = 200;

export class ListReturnRemindersQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    /** Vacío = pendientes y fallidos (la bandeja de trabajo de DEV-01). */
    public readonly statuses: readonly ReturnReminderStatus[] = ['PENDING', 'FAILED'],
    public readonly limit: number = RETURN_REMINDER_LIST_DEFAULT_LIMIT,
  ) {}
}
