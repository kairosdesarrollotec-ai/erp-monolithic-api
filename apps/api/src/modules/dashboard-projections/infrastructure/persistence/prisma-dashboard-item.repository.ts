import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  DashboardItemRecord,
  DashboardItemRepositoryPort,
  DashboardItemScope,
  UpsertDashboardItemInput,
} from '../../application/ports/dashboard-item-repository.port';

@Injectable()
export class PrismaDashboardItemRepository implements DashboardItemRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromEvent(input: UpsertDashboardItemInput): Promise<void> {
    await this.prisma.dashboardItem.upsert({
      where: { sourceEventId_itemType: { sourceEventId: input.sourceEventId, itemType: input.itemType } },
      create: {
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId,
        role: input.role,
        itemType: input.itemType,
        priority: input.priority,
        title: input.title,
        detail: input.detail ?? null,
        deepLink: input.deepLink,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceEventId: input.sourceEventId,
        expiresAt: input.expiresAt ?? null,
      },
      update: {},
    });
  }

  async dismissBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.prisma.dashboardItem.updateMany({
      where: { sourceType, sourceId, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
  }

  async listActive(scope: DashboardItemScope): Promise<DashboardItemRecord[]> {
    const rows = await this.prisma.dashboardItem.findMany({
      where: {
        organizationId: scope.organizationId,
        operatingCompanyId: scope.operatingCompanyId,
        branchId: scope.branchId,
        role: scope.role,
        dismissedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      itemType: row.itemType,
      priority: row.priority,
      title: row.title,
      detail: row.detail,
      deepLink: row.deepLink,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      createdAt: row.createdAt,
    }));
  }
}
