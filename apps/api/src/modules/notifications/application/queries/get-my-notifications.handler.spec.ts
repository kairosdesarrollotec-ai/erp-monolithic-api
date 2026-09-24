import { GetMyNotificationsHandler } from './get-my-notifications.handler';
import { GetMyNotificationsQuery } from './get-my-notifications.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { NotificationReadModelPort } from '../ports/notification-read-model.port';

function buildAuthorization() {
  return {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role: 'FRONT_OFFICE' }),
  } as unknown as WorkContextAuthorizationService;
}

function buildNotifications() {
  const port: jest.Mocked<NotificationReadModelPort> = {
    create: jest.fn(),
    listForRecipient: jest.fn().mockResolvedValue([
      { id: 'n1', notificationType: 'ReservationCreated', isEscalated: false, title: 'Reserva creada', deepLink: '/reservas/res-1', readAt: null, createdAt: new Date('2026-09-23T10:00:00Z') },
    ]),
    markAllRead: jest.fn(),
  };
  return port;
}

describe('GetMyNotificationsHandler', () => {
  it('devuelve las notificaciones del propio usuario autenticado, nunca de otro', async () => {
    const authorization = buildAuthorization();
    const notifications = buildNotifications();
    const handler = new GetMyNotificationsHandler(authorization, notifications);

    const result = await handler.execute(new GetMyNotificationsQuery('uid-1', 'company-1', 'branch-1'));

    expect(notifications.listForRecipient).toHaveBeenCalledWith('org-1', 'uid-1', { unreadOnly: undefined });
    expect(result).toHaveLength(1);
  });

  it('pasa el filtro unreadOnly al puerto', async () => {
    const authorization = buildAuthorization();
    const notifications = buildNotifications();
    const handler = new GetMyNotificationsHandler(authorization, notifications);

    await handler.execute(new GetMyNotificationsQuery('uid-1', 'company-1', 'branch-1', true));

    expect(notifications.listForRecipient).toHaveBeenCalledWith('org-1', 'uid-1', { unreadOnly: true });
  });
});
