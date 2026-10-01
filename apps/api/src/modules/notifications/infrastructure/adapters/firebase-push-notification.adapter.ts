import { Injectable, Logger } from '@nestjs/common';
import { getMessaging } from 'firebase-admin/messaging';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import {
  ChannelDeliveryResult,
  ChannelNotificationPayload,
  maskPushToken,
} from '../../domain/external-notification';
import { PushNotificationPort } from '../../application/ports/channel-notification.port';

@Injectable()
export class FirebasePushNotificationAdapter implements PushNotificationPort {
  private readonly logger = new Logger(FirebasePushNotificationAdapter.name);

  async send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult> {
    const { recipient, title, body, deepLink, sourceEventId } = payload;
    const tokens = recipient.pushTokens;

    if (!tokens || tokens.length === 0) {
      return {
        channel: 'PUSH',
        status: 'SKIPPED',
        recipientTarget: 'none',
        reason: 'NO_PUSH_TOKENS',
        attemptedAt: new Date(),
      };
    }

    const firstMaskedToken = maskPushToken(tokens[0]);

    try {
      initFirebaseAdmin();
      const messaging = getMessaging();

      const response = await messaging.sendEachForMulticast({
        tokens: [...tokens],
        notification: { title, body },
        data: {
          sourceEventId,
          deepLink: deepLink ?? '',
          eventType: payload.eventType,
        },
      });

      const firstSuccess = response.responses.find((r) => r.success);
      const isSuccess = response.successCount > 0;

      return {
        channel: 'PUSH',
        status: isSuccess ? 'DELIVERED' : 'FAILED',
        recipientTarget: firstMaskedToken,
        providerMessageId: firstSuccess?.messageId ?? 'fcm-batch',
        reason:
          response.failureCount > 0
            ? `${response.failureCount} tokens failed out of ${tokens.length}`
            : undefined,
        attemptedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `FCM multicast dispatch failed: ${(error as Error).message}`,
      );
      return {
        channel: 'PUSH',
        status: 'FAILED',
        recipientTarget: firstMaskedToken,
        error: { code: 'FCM_ERROR', message: (error as Error).message },
        attemptedAt: new Date(),
      };
    }
  }
}
