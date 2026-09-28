import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ChannelDeliveryResult,
  ChannelNotificationPayload,
  maskEmail,
} from '../../domain/external-notification';
import { EmailNotificationPort } from '../../application/ports/channel-notification.port';

@Injectable()
export class ConsoleEmailNotificationAdapter implements EmailNotificationPort {
  private readonly logger = new Logger(ConsoleEmailNotificationAdapter.name);

  async send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult> {
    const { recipient, title, body } = payload;
    const email = recipient.email;

    if (!email) {
      return {
        channel: 'EMAIL',
        status: 'SKIPPED',
        recipientTarget: 'none',
        reason: 'EMAIL_ADDRESS_MISSING',
        attemptedAt: new Date(),
      };
    }

    const messageId = `email-${randomUUID()}`;
    const masked = maskEmail(email);

    this.logger.log(
      `[DISPATCH EMAIL] id=${messageId} to=${masked} subject="${title}" len=${body.length}`,
    );

    return {
      channel: 'EMAIL',
      status: 'DELIVERED',
      recipientTarget: masked,
      providerMessageId: messageId,
      attemptedAt: new Date(),
    };
  }
}
