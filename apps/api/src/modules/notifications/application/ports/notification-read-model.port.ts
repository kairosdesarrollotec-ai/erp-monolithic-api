import type { Prisma } from '@prisma/client';

export interface NotificationRecord {
  id: string;
  notificationType: string;
  isEscalated: boolean;
  title: string;
  deepLink: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  organizationId: string;
  companyId: string;
  branchId: string;
  recipientFirebaseUid: string;
  notificationType: string;
  title: string;
  deepLink: string;
  sourceEventId: string;
}

export interface ListNotificationsFilter {
  unreadOnly?: boolean;
}

/**
 * TR-07. Ver la nota de alcance real en el modelo NotificationReadModel
 * (schema.prisma).
 */
export abstract class NotificationReadModelPort {
  /**
   * Idempotente por sourceEventId - reprocesar el mismo evento de
   * outbox_events no duplica la notificacion.
   */
  abstract create(input: CreateNotificationInput, tx?: Prisma.TransactionClient): Promise<void>;

  abstract listForRecipient(
    organizationId: string,
    recipientFirebaseUid: string,
    filter?: ListNotificationsFilter,
  ): Promise<NotificationRecord[]>;

  abstract markAllRead(organizationId: string, recipientFirebaseUid: string): Promise<void>;
}
