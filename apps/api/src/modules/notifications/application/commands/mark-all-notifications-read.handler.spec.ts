import { MarkAllNotificationsReadHandler } from './mark-all-notifications-read.handler';
import { MarkAllNotificationsReadCommand } from './mark-all-notifications-read.command';
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
    listForRecipient: jest.fn(),
    markAllRead: jest.fn().mockResolvedValue(undefined),
  };
  return port;
}

describe('MarkAllNotificationsReadHandler', () => {
  it('marca como leidas solo las notificaciones del propio usuario autenticado', async () => {
    const authorization = buildAuthorization();
    const notifications = buildNotifications();
    const handler = new MarkAllNotificationsReadHandler(authorization, notifications);

    await handler.execute(new MarkAllNotificationsReadCommand('uid-1', 'company-1', 'branch-1'));

    expect(notifications.markAllRead).toHaveBeenCalledWith('org-1', 'uid-1');
  });
});
