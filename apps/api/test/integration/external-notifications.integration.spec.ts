import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';
import { PrismaService } from '../../src/common/persistence/prisma.service';
import { PrismaDashboardItemRepository } from '../../src/modules/dashboard-projections/infrastructure/persistence/prisma-dashboard-item.repository';
import { PrismaNotificationReadModelRepository } from '../../src/modules/notifications/infrastructure/persistence/prisma-notification-read-model.repository';
import { PrismaNotificationTemplateRepository } from '../../src/modules/notification-templates/infrastructure/persistence/prisma-notification-template.repository';
import { OutboxRelayService } from '../../src/modules/dashboard-projections/infrastructure/outbox-relay.service';
import { OutboxEventConsumerRegistry } from '../../src/modules/outbox/application/outbox-event-consumer.registry';
import { NotificationDispatcherPort } from '../../src/modules/notifications/application/ports/notification-dispatcher.port';

describe('TR-07 - Despacho Externo de Notificaciones (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let outboxRelay: OutboxRelayService;
  let dispatcherMock: jest.Mocked<NotificationDispatcherPort>;

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;

    const prismaService = prisma as unknown as PrismaService;
    const dashboardItems = new PrismaDashboardItemRepository(prismaService);
    const notifications = new PrismaNotificationReadModelRepository(prismaService);
    const notificationTemplates = new PrismaNotificationTemplateRepository(prismaService);

    dispatcherMock = {
      dispatch: jest.fn().mockResolvedValue({
        sourceEventId: 'mock-evt',
        recipientId: 'mock-rec',
        deliveries: [],
        overallStatus: 'ALL_DELIVERED',
        dispatchedAt: new Date(),
      }),
    };

    outboxRelay = new OutboxRelayService(
      prismaService,
      dashboardItems,
      notifications,
      notificationTemplates,
      dispatcherMock,
      new OutboxEventConsumerRegistry(),
    );
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.stop();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('procesa el evento outbox, proyecta in-app y despacha a canales configurados en la plantilla vigente', async () => {
    const orgId = randomUUID();
    const companyId = randomUUID();
    const branchId = randomUUID();
    const vehicleId = randomUUID();
    const actorUid = `user-${randomUUID()}`;
    const reservationId = randomUUID();
    const eventId = randomUUID();

    // 1. Crear plantilla con canales EMAIL y PUSH
    await prisma.notificationTemplateVersion.create({
      data: {
        organizationId: orgId,
        eventType: 'ReservationCreated',
        version: 1,
        channels: ['EMAIL', 'PUSH'],
        body: 'Reserva creada para {vehiculo}',
        createdBy: 'admin-tester',
      },
    });

    // 2. Insertar evento outbox pendiente
    await prisma.outboxEvent.create({
      data: {
        id: eventId,
        aggregateType: 'Reservation',
        aggregateId: reservationId,
        eventType: 'ReservationCreated',
        payload: {
          organizationId: orgId,
          operatingCompanyId: companyId,
          branchId,
          vehicleId,
          createdBy: actorUid,
          startAt: '2026-10-01T00:00:00Z',
          endAt: '2026-10-02T00:00:00Z',
        },
      },
    });

    // 3. Ejecutar ciclo del outbox relay
    await outboxRelay.processPendingEvents();

    // 4. Verificar que se invocó el dispatcher externo con los canales de la plantilla
    expect(dispatcherMock.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith({
      sourceEventId: eventId,
      eventType: 'ReservationCreated',
      organizationId: orgId,
      companyId,
      branchId,
      recipientFirebaseUid: actorUid,
      title: `Reserva creada para ${vehicleId}`,
      body: `Reserva creada para ${vehicleId}`,
      deepLink: `/reservas/${reservationId}`,
      channels: ['EMAIL', 'PUSH'],
    });

    // 5. Verificar que el outbox event fue marcado procesado en la BD real
    const [processedEvent] = await prisma.$queryRaw<
      Array<{ processed_at: Date | null; dead_lettered_at: Date | null }>
    >`SELECT processed_at, dead_lettered_at FROM outbox_events WHERE id = ${eventId}`;
    expect(processedEvent?.processed_at).not.toBeNull();
    expect(processedEvent?.dead_lettered_at).toBeNull();

    // 6. Verificar que la notificación in-app se persistió en la BD real
    const createdNotification = await prisma.notificationReadModel.findUnique({
      where: { sourceEventId: eventId },
    });
    expect(createdNotification).not.toBeNull();
    expect(createdNotification?.recipientFirebaseUid).toBe(actorUid);
    expect(createdNotification?.title).toBe(`Reserva creada para ${vehicleId}`);
  });

  it('resiliencia: si el despacho externo arroja un error crítico, el relay NO aborta y marca el evento como procesado', async () => {
    const orgId = randomUUID();
    const companyId = randomUUID();
    const branchId = randomUUID();
    const vehicleId = randomUUID();
    const actorUid = `user-${randomUUID()}`;
    const reservationId = randomUUID();
    const eventId = randomUUID();

    await prisma.notificationTemplateVersion.create({
      data: {
        organizationId: orgId,
        eventType: 'ReservationCreated',
        version: 1,
        channels: ['EMAIL'],
        body: 'Alerta de reserva',
        createdBy: 'admin-tester',
      },
    });

    await prisma.outboxEvent.create({
      data: {
        id: eventId,
        aggregateType: 'Reservation',
        aggregateId: reservationId,
        eventType: 'ReservationCreated',
        payload: {
          organizationId: orgId,
          operatingCompanyId: companyId,
          branchId,
          vehicleId,
          createdBy: actorUid,
          startAt: '2026-10-01T00:00:00Z',
          endAt: '2026-10-02T00:00:00Z',
        },
      },
    });

    // Simular caída de gateway SMTP o red externa
    dispatcherMock.dispatch.mockRejectedValueOnce(
      new Error('ETIMEDOUT: Connection to external mail provider timed out'),
    );

    // Ejecutar ciclo
    await outboxRelay.processPendingEvents();

    expect(dispatcherMock.dispatch).toHaveBeenCalledTimes(1);

    // El evento outbox se marca procesado a pesar del fallo externo (no se reintenta indefinidamente ni va a DLQ)
    const [processedEvent] = await prisma.$queryRaw<
      Array<{ processed_at: Date | null; dead_lettered_at: Date | null }>
    >`SELECT processed_at, dead_lettered_at FROM outbox_events WHERE id = ${eventId}`;
    expect(processedEvent?.processed_at).not.toBeNull();
    expect(processedEvent?.dead_lettered_at).toBeNull();

    // La notificación in-app persiste intacta
    const createdNotification = await prisma.notificationReadModel.findUnique({
      where: { sourceEventId: eventId },
    });
    expect(createdNotification).not.toBeNull();
  });

  it('omite despacho externo si la plantilla no tiene canales externos', async () => {
    const orgId = randomUUID();
    const companyId = randomUUID();
    const branchId = randomUUID();
    const vehicleId = randomUUID();
    const actorUid = `user-${randomUUID()}`;
    const reservationId = randomUUID();
    const eventId = randomUUID();

    await prisma.notificationTemplateVersion.create({
      data: {
        organizationId: orgId,
        eventType: 'ReservationCreated',
        version: 1,
        channels: [],
        body: 'Solo in-app',
        createdBy: 'admin-tester',
      },
    });

    await prisma.outboxEvent.create({
      data: {
        id: eventId,
        aggregateType: 'Reservation',
        aggregateId: reservationId,
        eventType: 'ReservationCreated',
        payload: {
          organizationId: orgId,
          operatingCompanyId: companyId,
          branchId,
          vehicleId,
          createdBy: actorUid,
          startAt: '2026-10-01T00:00:00Z',
          endAt: '2026-10-02T00:00:00Z',
        },
      },
    });

    await outboxRelay.processPendingEvents();

    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();

    const [processedEvent] = await prisma.$queryRaw<
      Array<{ processed_at: Date | null }>
    >`SELECT processed_at FROM outbox_events WHERE id = ${eventId}`;
    expect(processedEvent?.processed_at).not.toBeNull();
  });
});
