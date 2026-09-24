import type { NotificationChannel } from '../../../notification-templates/domain/notification-variable-catalog';

export class SaveNotificationTemplateCommand {
  constructor(
    public readonly actorFirebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly eventType: string,
    public readonly channels: NotificationChannel[],
    public readonly body: string,
  ) {}
}
