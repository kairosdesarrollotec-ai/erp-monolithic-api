import { Prisma } from '@prisma/client';
import { ReservationReminderRecord, ReservationReminderResult } from '../../domain/reservation-reminder';

export interface RegisterReminderInput {
  reservationId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  result: ReservationReminderResult;
  dueAt: Date;
  messageText: string;
  sentAt: Date;
  sentBy: string;
  note: string | null;
}

export abstract class ReservationReminderRepositoryPort {
  abstract findByReservationId(
    reservationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationReminderRecord | null>;

  abstract registerReminder(
    input: RegisterReminderInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationReminderRecord>;
}
