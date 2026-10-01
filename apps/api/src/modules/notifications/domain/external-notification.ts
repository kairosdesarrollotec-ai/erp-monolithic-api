import { NotificationChannel } from '../../notification-templates/domain/notification-variable-catalog';

export interface RecipientContact {
  readonly recipientId: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly pushTokens: readonly string[];
  readonly displayName: string | null;
}

export interface ChannelNotificationPayload {
  readonly sourceEventId: string;
  readonly organizationId: string;
  readonly companyId: string;
  readonly branchId: string;
  readonly eventType: string;
  readonly recipient: RecipientContact;
  readonly title: string;
  readonly body: string;
  readonly deepLink?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type ChannelDeliveryStatus = 'DELIVERED' | 'FAILED' | 'SKIPPED';

export interface ChannelDeliveryResult {
  readonly channel: NotificationChannel;
  readonly status: ChannelDeliveryStatus;
  readonly recipientTarget: string; // PII-masked identifier
  readonly providerMessageId?: string;
  readonly reason?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly attemptedAt: Date;
}

export type OverallDeliveryStatus =
  | 'ALL_DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'FAILED'
  | 'ALL_SKIPPED';

export interface ExternalNotificationDispatchResult {
  readonly sourceEventId: string;
  readonly recipientId: string;
  readonly deliveries: readonly ChannelDeliveryResult[];
  readonly overallStatus: OverallDeliveryStatus;
  readonly dispatchedAt: Date;
}

export function computeOverallDeliveryStatus(
  deliveries: readonly ChannelDeliveryResult[],
): OverallDeliveryStatus {
  if (deliveries.length === 0) return 'ALL_SKIPPED';
  const delivered = deliveries.filter((d) => d.status === 'DELIVERED');
  const failed = deliveries.filter((d) => d.status === 'FAILED');
  const skipped = deliveries.filter((d) => d.status === 'SKIPPED');

  if (delivered.length === deliveries.length) return 'ALL_DELIVERED';
  if (skipped.length === deliveries.length) return 'ALL_SKIPPED';
  if (failed.length === deliveries.length) return 'FAILED';
  return 'PARTIALLY_DELIVERED';
}

export function maskEmail(email: string | null): string {
  if (!email) return 'none';
  const [local, domain] = email.split('@');
  if (!domain) return 'invalid-email';
  const maskedLocal =
    local.length > 2
      ? `${local[0]}***${local[local.length - 1]}`
      : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

export function maskPhoneNumber(phone: string | null): string {
  if (!phone) return 'none';
  if (phone.length <= 4) return '***';
  return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

export function maskPushToken(token: string): string {
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
