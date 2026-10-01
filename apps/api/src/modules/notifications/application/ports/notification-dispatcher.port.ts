import { NotificationChannel } from '../../../notification-templates/domain/notification-variable-catalog';
import { ExternalNotificationDispatchResult } from '../../domain/external-notification';

export interface DispatchNotificationInput {
  readonly sourceEventId: string;
  readonly eventType: string;
  readonly organizationId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly recipientFirebaseUid: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink?: string;
  readonly channels: readonly NotificationChannel[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export abstract class NotificationDispatcherPort {
  abstract dispatch(
    input: DispatchNotificationInput,
  ): Promise<ExternalNotificationDispatchResult>;
}
