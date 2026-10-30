import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ActiveWarrantyDashboardItem,
  ReturnDashboardAlertPort,
} from '../../application/ports/return-dashboard-alert.port';
import type { ReturnRecord } from '../../application/ports/return-repository.port';
import {
  RETURN_DASHBOARD_SOURCE_TYPE,
  ReturnDashboardItemInput,
  WARRANTY_DASHBOARD_KEY_PREFIX,
} from '../../domain/return-dashboard-alerts';
import { LATE_CHARGE_REGISTRABLE_STATUSES, RETURN_LATE_TOLERANCE_MS } from '../../domain/return-lateness';
import { RETURN_INCLUDE, toReturnRecord } from './return-persistence.mapper';

@Injectable()
export class PrismaReturnDashboardAlertPersistence implements ReturnDashboardAlertPort {
  constructor(private readonly prisma: PrismaService) {}

  async listWarrantyCandidates(receivedBefore: Date, limit: number, afterId?: string): Promise<ReturnRecord[]> {
    const rows = await this.prisma.rentalReturn.findMany({
      where: { status: 'SIN_DANOS', receivedAt: { not: null, lte: receivedBefore }, ...(afterId ? { id: { gt: afterId } } : {}) },
      orderBy: { id: 'asc' },
      take: limit,
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }

  async createDashboardItems(items: readonly ReturnDashboardItemInput[]): Promise<number> {
    if (items.length === 0) return 0;
    // INSERT ... ON CONFLICT DO NOTHING sobre (source_event_id, item_type): seguro con varias réplicas / reintentos.
    const result = await this.prisma.dashboardItem.createMany({
      data: items.map((item) => ({
        organizationId: item.organizationId,
        operatingCompanyId: item.operatingCompanyId,
        branchId: item.branchId,
        role: item.role,
        itemType: item.itemType,
        priority: item.priority,
        title: item.title,
        detail: item.detail,
        deepLink: item.deepLink,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceEventId: item.sourceEventId,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async listActiveWarrantyItems(limit: number, afterId?: string): Promise<ActiveWarrantyDashboardItem[]> {
    return this.listActiveItems(`${WARRANTY_DASHBOARD_KEY_PREFIX}:`, limit, afterId);
  }

  async listLateChargeCandidates(now: Date, limit: number, afterId?: string): Promise<ReturnRecord[]> {
    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        status: { in: [...LATE_CHARGE_REGISTRABLE_STATUSES] },
        receivedAt: { not: null },
        lateChargeAmount: null,
        scheduledAt: { lte: new Date(now.getTime() - RETURN_LATE_TOLERANCE_MS) },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }

  async listImmobilizationCandidates(closedBefore: Date, limit: number, afterId?: string): Promise<ReturnRecord[]> {
    const rows = await this.prisma.rentalReturn.findMany({
      where: {
        // BR-DEV-011 (22-oct-2026): reloj desde el cierre de la devolucion.
        status: 'CERRADA',
        closedAt: { not: null, lte: closedBefore },
        damages: { some: { origin: 'TECHNICAL' } },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      include: RETURN_INCLUDE,
    });
    return rows.map(toReturnRecord);
  }

  async listActiveItems(keyPrefix: string, limit: number, afterId?: string): Promise<ActiveWarrantyDashboardItem[]> {
    const rows = await this.prisma.dashboardItem.findMany({
      where: {
        sourceType: RETURN_DASHBOARD_SOURCE_TYPE,
        dismissedAt: null,
        sourceEventId: { startsWith: keyPrefix },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
      select: { id: true, sourceId: true, sourceEventId: true, role: true, organizationId: true, operatingCompanyId: true, branchId: true },
    });
    return rows;
  }

  async findReturnsByIds(ids: readonly string[]): Promise<ReturnRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.rentalReturn.findMany({ where: { id: { in: [...ids] } }, include: RETURN_INCLUDE });
    return rows.map(toReturnRecord);
  }

  async dismissByReturn(returnId: string, keyPrefixes: readonly string[], at: Date): Promise<number> {
    if (keyPrefixes.length === 0) return 0;
    const result = await this.prisma.dashboardItem.updateMany({
      where: {
        sourceType: RETURN_DASHBOARD_SOURCE_TYPE,
        sourceId: returnId,
        dismissedAt: null,
        OR: keyPrefixes.map((prefix) => ({ sourceEventId: { startsWith: prefix } })),
      },
      data: { dismissedAt: at },
    });
    return result.count;
  }

  async dismissItems(ids: readonly string[], at: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prisma.dashboardItem.updateMany({
      where: { id: { in: [...ids] }, dismissedAt: null },
      data: { dismissedAt: at },
    });
    return result.count;
  }
}
