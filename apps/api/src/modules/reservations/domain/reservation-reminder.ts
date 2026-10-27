import { DomainUnprocessableError } from '../../../common/domain/domain-errors';

export const RESERVATION_REMINDER_RESULTS = ['SENT', 'FAILED'] as const;
export type ReservationReminderResult = (typeof RESERVATION_REMINDER_RESULTS)[number];

export type ReservationReminderStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ReservationReminderRecord {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  reservationId: string;
  status: ReservationReminderStatus;
  dueAt: Date;
  messageText: string;
  generatedAt: Date;
  sentAt: Date | null;
  sentBy: string | null;
  resultNote: string | null;
  attempts: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class InvalidReservationReminderResultError extends DomainUnprocessableError {
  readonly code = 'INVALID_REMINDER_RESULT';

  constructor(detail: string) {
    super(detail);
  }
}
