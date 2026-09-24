import { Injectable } from '@nestjs/common';
import type { NotificationReadModel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateNotificationInput,
  ListNotificationsFilter,
  NotificationReadModelPort,
  NotificationRecord,
} from '../../application/ports/notification-read-model.port';

@Injectable()
export class PrismaNotificationReadModelRepository implements NotificationReadModelPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.notificationReadModel.upsert({
      where: { sourceEventId: input.sourceEventId },
      create: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        branchId: input.branchId,
        recipientFirebaseUid: input.recipientFirebaseUid,
        notificationType: input.notificationType,
        title: input.title,
        deepLink: input.deepLink,
        sourceEventId: input.sourceEventId,
      },
      update: {},
    });
  }

  async listForRecipient(
    organizationId: string,
    recipientFirebaseUid: string,
    filter: ListNotificationsFilter = {},
  ): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notificationReadModel.findMany({
      where: {
        organizationId,
        recipientFirebaseUid,
        ...(filter.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toRecord(row));
  }

  async markAllRead(organizationId: string, recipientFirebaseUid: string): Promise<void> {
    await this.prisma.notificationReadModel.updateMany({
      where: { organizationId, recipientFirebaseUid, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private toRecord(row: NotificationReadModel): NotificationRecord {
    return {
      id: row.id,
      notificationType: row.notificationType,
      isEscalated: row.isEscalated,
      title: row.title,
      deepLink: row.deepLink,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
