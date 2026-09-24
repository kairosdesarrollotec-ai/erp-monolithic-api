import { Injectable } from '@nestjs/common';
import type { NotificationTemplateVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import type { NotificationChannel } from '../../domain/notification-variable-catalog';
import {
  CreateNotificationTemplateVersionInput,
  NotificationTemplatePort,
  NotificationTemplateSnapshot,
} from '../../application/ports/notification-template.port';

@Injectable()
export class PrismaNotificationTemplateRepository implements NotificationTemplatePort {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string, eventType: string): Promise<NotificationTemplateSnapshot | null> {
    const latest = await this.prisma.notificationTemplateVersion.findFirst({
      where: { organizationId, eventType },
      orderBy: { version: 'desc' },
    });
    return latest ? this.toSnapshot(latest) : null;
  }

  async listHistory(organizationId: string, eventType: string): Promise<NotificationTemplateSnapshot[]> {
    const rows = await this.prisma.notificationTemplateVersion.findMany({
      where: { organizationId, eventType },
      orderBy: { version: 'desc' },
    });
    return rows.map((row: NotificationTemplateVersion) => this.toSnapshot(row));
  }

  async createVersion(
    organizationId: string,
    input: CreateNotificationTemplateVersionInput,
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationTemplateSnapshot> {
    const client = tx ?? this.prisma;
    const latest = await client.notificationTemplateVersion.findFirst({
      where: { organizationId, eventType: input.eventType },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const created = await client.notificationTemplateVersion.create({
      data: {
        organizationId,
        eventType: input.eventType,
        version: nextVersion,
        channels: input.channels,
        body: input.body,
        createdBy,
      },
    });
    return this.toSnapshot(created);
  }

  private toSnapshot(row: NotificationTemplateVersion): NotificationTemplateSnapshot {
    return {
      eventType: row.eventType,
      version: row.version,
      channels: row.channels as NotificationChannel[],
      body: row.body,
    };
  }
}
