import { PrismaReturnDashboardAlertPersistence } from './prisma-return-dashboard-alert.persistence';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { buildWarrantyDashboardItem } from '../../domain/return-dashboard-alerts';
import { computeWarrantyReleaseAlert } from '../../domain/return-alerts';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    rentalReturn: { findMany: jest.fn().mockResolvedValue([]) },
    dashboardItem: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
  return { prisma, persistence: new PrismaReturnDashboardAlertPersistence(prisma as unknown as PrismaService) };
}

describe('PrismaReturnDashboardAlertPersistence (DEC-DEVREM-002)', () => {
  it('createDashboardItems usa INSERT ... ON CONFLICT DO NOTHING (skipDuplicates) y devuelve solo lo realmente creado', async () => {
    const { prisma, persistence } = build();
    prisma.dashboardItem.createMany.mockResolvedValue({ count: 1 });
    const received = new Date('2026-10-05T12:00:00Z');
    const alert = computeWarrantyReleaseAlert({ status: 'SIN_DANOS', receivedAt: received, vehicleDailyRate: null }, new Date(received.getTime() + 22 * 3_600_000))!;
    const item = buildWarrantyDashboardItem(
      { id: 'ret-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'br-1', vehiclePlate: 'ABC-123' },
      alert,
    );

    expect(await persistence.createDashboardItems([item])).toBe(1);
    expect(prisma.dashboardItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ role: 'FINANZAS', itemType: 'ALERT', sourceType: 'RETURN', sourceId: 'ret-1', sourceEventId: 'return-warranty:DUE_SOON:ret-1' })],
      skipDuplicates: true,
    });
    expect(await persistence.createDashboardItems([])).toBe(0);
  });

  it('listWarrantyCandidates: SIN_DANOS recibidas, paginadas por id', async () => {
    const { prisma, persistence } = build();
    const before = new Date('2026-10-05T12:00:00Z');
    await persistence.listWarrantyCandidates(before, 50, 'ret-5');
    expect(prisma.rentalReturn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SIN_DANOS', receivedAt: { not: null, lte: before }, id: { gt: 'ret-5' } },
        orderBy: { id: 'asc' },
        take: 50,
      }),
    );
  });

  it('listActiveWarrantyItems: solo los activos de origen RETURN con clave de garantía', async () => {
    const { prisma, persistence } = build();
    await persistence.listActiveWarrantyItems(10);
    expect(prisma.dashboardItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceType: 'RETURN', dismissedAt: null, sourceEventId: { startsWith: 'return-warranty:' } },
      }),
    );
  });

  it('dismissItems descarta (no borra) solo los aún activos y es idempotente', async () => {
    const { prisma, persistence } = build();
    prisma.dashboardItem.updateMany.mockResolvedValue({ count: 2 });
    const at = new Date('2026-10-05T12:00:00Z');
    expect(await persistence.dismissItems(['a', 'b'], at)).toBe(2);
    expect(prisma.dashboardItem.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, dismissedAt: null }, data: { dismissedAt: at } });
    expect(await persistence.dismissItems([], at)).toBe(0);
  });
});
