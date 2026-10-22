import { OutboxEventConsumerRegistry } from '../../outbox/application/outbox-event-consumer.registry';
import { OutboxRelayService } from './outbox-relay.service';
import { PrismaService } from '../../../common/persistence/prisma.service';
import { DashboardItemRepositoryPort } from '../application/ports/dashboard-item-repository.port';
import { NotificationReadModelPort } from '../../notifications/application/ports/notification-read-model.port';
import { NotificationTemplatePort } from '../../notification-templates/application/ports/notification-template.port';
import { NotificationDispatcherPort } from '../../notifications/application/ports/notification-dispatcher.port';

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

  const dispatcher: jest.Mocked<NotificationDispatcherPort> = {
    dispatch: jest.fn().mockResolvedValue({
      sourceEventId: 'event-1',
      recipientId: 'user-1',
      deliveries: [],
      overallStatus: 'ALL_DELIVERED',
      dispatchedAt: new Date(),
    }),
  };

  return { prisma, dashboardItems, notifications, notificationTemplates, dispatcher };
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
    const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

    await service.processPendingEvents();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(dashboardItems.upsertFromEvent).toHaveBeenCalled();
    // 1 UPDATE de markProcessed
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('si la proyeccion falla, incrementa attempts y aplica backoff (no marca processed_at)', async () => {
    const event = buildEventRow({ attempts: 0 });
    const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
    dashboardItems.dismissBySource.mockRejectedValue(new Error('fallo de proyeccion'));
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

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
    const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
    dashboardItems.dismissBySource.mockRejectedValue(new Error('fallo definitivo'));
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

    await service.processPendingEvents();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const [sqlFragment] = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    const rendered = sqlFragment.values ? sqlFragment.strings.join('?') : String(sqlFragment);
    expect(rendered).toContain('dead_lettered_at = now()');
  });

  it('no solapa ciclos del mismo proceso si uno todavia esta corriendo', async () => {
    const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([]);
    let resolveFirstClaim: (value: unknown) => void = () => undefined;
    (prisma.$queryRaw as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirstClaim = resolve)),
    );
    const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

    const firstCall = service.processPendingEvents();
    const secondCall = service.processPendingEvents();
    resolveFirstClaim([]);
    await Promise.all([firstCall, secondCall]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  describe('TR-07 - claimBatch procesa eventos de cualquier aggregate_type', () => {
    it('procesa eventos con aggregate_type distinto de Reservation (CandidatoSeleccionado.v1)', async () => {
      const event = buildEventRow({
        aggregateType: 'Candidate',
        aggregateId: 'candidate-1',
        eventType: 'CandidatoSeleccionado.v1',
        payload: {
          candidateId: 'candidate-1',
          vacancyId: 'vacancy-1',
          fullName: 'Juan Perez',
          documentNumber: '12345678',
          decision: 'CONTRATADO',
          decidedAt: '2026-10-10T00:00:00Z',
          decidedBy: 'uid-recruiter',
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

      await service.processPendingEvents();

      // claimBatch ejecutado (sin filtro por aggregate_type)
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      // projectReservationEvent devuelve IGNORE para eventos no-Reservation
      expect(dashboardItems.upsertFromEvent).not.toHaveBeenCalled();
      expect(dashboardItems.dismissBySource).not.toHaveBeenCalled();
      // projectNotificationEvent genera notificacion in-app para CandidatoSeleccionado.v1
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: 'CandidatoSeleccionado.v1',
          recipientFirebaseUid: 'uid-recruiter',
          deepLink: '/reclutamiento',
        }),
      );
      // Evento marcado como procesado
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('procesa eventos con aggregate_type Employee (RelacionLaboralTerminada.v1) y crea notificacion in-app', async () => {
      const event = buildEventRow({
        aggregateType: 'Employee',
        aggregateId: 'employee-1',
        eventType: 'RelacionLaboralTerminada.v1',
        payload: {
          employeeId: 'employee-1',
          terminationId: 'termination-1',
          reason: 'RENUNCIA',
          noticeDays: 15,
          terminatedAt: '2026-10-10T00:00:00Z',
          areaId: 'area-1',
          areaName: 'Ventas',
          jobTitle: 'Asesor',
          actorUserId: 'uid-hr-manager',
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

      await service.processPendingEvents();

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: 'RelacionLaboralTerminada.v1',
          recipientFirebaseUid: 'uid-hr-manager',
          deepLink: '/personal',
        }),
      );
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('procesa eventos con aggregate_type rental (ContratoFirmado.v1) y los ignora sin crear notificacion', async () => {
      const event = buildEventRow({
        aggregateType: 'rental',
        aggregateId: 'rental-1',
        eventType: 'ContratoFirmado.v1',
        payload: {
          rentalId: 'rental-1',
          documentRef: 'doc-ref-001',
          signedAt: '2026-10-10T00:00:00Z',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);
      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());

      await service.processPendingEvents();

      // Sin notificacion in-app (IGNORE: payload sin organizationId ni actor)
      expect(notifications.create).not.toHaveBeenCalled();
      // Evento marcado como procesado igualmente (BR-NOT-002: IGNORE no es fallo)
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [sqlFragment] = (prisma.$executeRaw as jest.Mock).mock.calls[0];
      const rendered = sqlFragment.values ? sqlFragment.strings.join('?') : String(sqlFragment);
      expect(rendered).toContain('processed_at = now()');
    });
  });

  describe('TR-07 - Despacho externo de notificaciones', () => {
    it('despacha a canales externos cuando la plantilla vigente tiene canales configurados', async () => {
      const event = buildEventRow({
        eventType: 'ReservationCreated',
        payload: {
          organizationId: 'org-1',
          operatingCompanyId: 'company-1',
          branchId: 'branch-1',
          vehicleId: 'vehicle-1',
          createdBy: 'user-created-1',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);

      notificationTemplates.getCurrent.mockResolvedValue({
        eventType: 'ReservationCreated',
        version: 1,
        body: 'Reserva creada para {vehiculo}',
        channels: ['EMAIL', 'PUSH'],
      });

      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());
      await service.processPendingEvents();

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceEventId: event.id,
          eventType: 'ReservationCreated',
          organizationId: 'org-1',
          recipientFirebaseUid: 'user-created-1',
          channels: ['EMAIL', 'PUSH'],
        }),
      );
      // El evento debe marcarse procesado normalmente
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('resiliencia: si el despacho externo falla, no aborta el outbox relay y marca procesado', async () => {
      const event = buildEventRow({
        eventType: 'ReservationConfirmed',
        payload: {
          organizationId: 'org-1',
          confirmedBy: 'user-confirmed-1',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);

      notificationTemplates.getCurrent.mockResolvedValue({
        eventType: 'ReservationConfirmed',
        version: 1,
        body: 'Reserva confirmada',
        channels: ['EMAIL'],
      });
      dispatcher.dispatch.mockRejectedValue(new Error('FCM / SMTP connection timeout'));

      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());
      await service.processPendingEvents();

      // In-app creada
      expect(notifications.create).toHaveBeenCalledTimes(1);
      // Despacho intentado
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      // Evento procesado exitosamente en BD (no marcado como fallido)
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      const [sqlFragment] = (prisma.$executeRaw as jest.Mock).mock.calls[0];
      const rendered = sqlFragment.values ? sqlFragment.strings.join('?') : String(sqlFragment);
      expect(rendered).toContain('processed_at = now()');
      expect(rendered).not.toContain('attempts');
    });

    it('omite despacho externo si la plantilla no tiene canales externos configurados', async () => {
      const event = buildEventRow({
        eventType: 'ReservationCancelled',
        payload: {
          organizationId: 'org-1',
          cancelledBy: 'user-cancelled-1',
        },
      });
      const { prisma, dashboardItems, notifications, notificationTemplates, dispatcher } = buildDeps([event]);

      notificationTemplates.getCurrent.mockResolvedValue({
        eventType: 'ReservationCancelled',
        version: 1,
        body: 'Reserva cancelada',
        channels: [],
      });

      const service = new OutboxRelayService(prisma, dashboardItems, notifications, notificationTemplates, dispatcher, new OutboxEventConsumerRegistry());
      await service.processPendingEvents();

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });
});
