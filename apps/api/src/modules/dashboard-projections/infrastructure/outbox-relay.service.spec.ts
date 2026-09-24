import { OutboxRelayService } from './outbox-relay.service';
import { PrismaService } from '../../../common/persistence/prisma.service';
import { DashboardItemRepositoryPort } from '../application/ports/dashboard-item-repository.port';
import { NotificationReadModelPort } from '../../notifications/application/ports/notification-read-model.port';
import { NotificationTemplatePort } from '../../notification-templates/application/ports/notification-template.port';

function buildEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    aggregateType: 'Reservation',
    aggregateId: 'reservation-1',
    eventType: 'ReservationConfirmed',
    payload: { organizationId: 'org-1' },
    createdAt: new Date('2026-09-24T00:00:00Z'),
    attempts: 0,
    ...overrides,
  };
}

function buildDeps(claimed: ReturnType<typeof buildEventRow>[]) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(claimed),
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<PrismaService>;

  const dashboardItems: jest.Mocked<DashboardItemRepositoryPort> = {
    upsertFromEvent: jest.fn().mockResolvedValue(undefined),
    dismissBySource: jest.fn().mockResolvedValue(undefined),
    listActive: jest.fn(),
  } as any;

  const notifications: jest.Mocked<NotificationReadModelPort> = {
    create: jest.fn().mockResolvedValue(undefined),
    listForRecipient: jest.fn(),
    markAllRead: jest.fn(),
  } as any;

  const notificationTemplates: jest.Mocked<NotificationTemplatePort> = {
    getCurrent: jest.fn().mockResolvedValue(null),
    listHistory: jest.fn(),
    createVersion: jest.fn(),
  };

  return { prisma, dashboardItems, notifications, notificationTemplates };
}

describe('OutboxRelayService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reclama eventos pendientes via SQL crudo (claim atomico) y los marca procesados al proyectarse con exito', async () => {
    const event = buildEventRow({
      eventType: 'ReservationCreated',
      payload: {
        organizationId: 'org-1',
        operatingCompanyId: 'company-1',
        branchId: 'branch-1',
        vehicleId: 'vehicle-1',
        startAt: '2026-10-01T00:00:00Z',
        endAt: '2026-10-02T00:00:00Z',
      },
    });
    const { prisma, dashboardItems, notifications, notificationTemplates } = buildDeps([event]);
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates);

    await service.processPendingEvents();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(dashboardItems.upsertFromEvent).toHaveBeenCalled();
    // 1 UPDATE de markProcessed
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('si la proyeccion falla, incrementa attempts y aplica backoff (no marca processed_at)', async () => {
    const event = buildEventRow({ attempts: 0 });
    const { prisma, dashboardItems, notifications, notificationTemplates } = buildDeps([event]);
    dashboardItems.dismissBySource.mockRejectedValue(new Error('fallo de proyeccion'));
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates);

    await service.processPendingEvents();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const [sqlFragment] = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    const rendered = sqlFragment.values ? sqlFragment.strings.join('?') : String(sqlFragment);
    expect(rendered).toContain('attempts');
    expect(rendered).not.toContain('dead_lettered_at = now()');
  });

  it('tras agotar maxAttempts, marca dead_lettered_at y deja de reintentar', async () => {
    const maxAttempts = Number(process.env.OUTBOX_RELAY_MAX_ATTEMPTS ?? 10);
    const event = buildEventRow({ attempts: maxAttempts - 1 });
    const { prisma, dashboardItems, notifications, notificationTemplates } = buildDeps([event]);
    dashboardItems.dismissBySource.mockRejectedValue(new Error('fallo definitivo'));
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates);

    await service.processPendingEvents();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const [sqlFragment] = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    const rendered = sqlFragment.values ? sqlFragment.strings.join('?') : String(sqlFragment);
    expect(rendered).toContain('dead_lettered_at = now()');
  });

  it('no solapa ciclos del mismo proceso si uno todavia esta corriendo', async () => {
    const { prisma, dashboardItems, notifications, notificationTemplates } = buildDeps([]);
    let resolveFirstClaim: (value: unknown) => void = () => undefined;
    (prisma.$queryRaw as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirstClaim = resolve)),
    );
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates);

    const firstCall = service.processPendingEvents();
    const secondCall = service.processPendingEvents();
    resolveFirstClaim([]);
    await Promise.all([firstCall, secondCall]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
