import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ChannelDeliveryResult,
  ChannelNotificationPayload,
  maskPhoneNumber,
} from '../../domain/external-notification';
import { SmsNotificationPort } from '../../application/ports/channel-notification.port';

const GSM_160_LIMIT = 160;

@Injectable()
export class ConsoleSmsNotificationAdapter implements SmsNotificationPort {
  private readonly logger = new Logger(ConsoleSmsNotificationAdapter.name);

  async send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult> {
    const { recipient, body } = payload;
    const phone = recipient.phoneNumber;

    if (!phone) {
      return {
        channel: 'SMS',
        status: 'SKIPPED',
        recipientTarget: 'none',
        reason: 'PHONE_NUMBER_MISSING',
        attemptedAt: new Date(),
      };
    }

    const messageId = `sms-${randomUUID()}`;
    const masked = maskPhoneNumber(phone);

    if (body.length > GSM_160_LIMIT) {
      this.logger.warn(
        `SMS message length (${body.length}) exceeds 160 GSM standard chars; multi-part delivery expected`,
      );
    }

    this.logger.log(
      `[DISPATCH SMS] id=${messageId} to=${masked} chars=${body.length}`,
    );

    return {
      channel: 'SMS',
      status: 'DELIVERED',
      recipientTarget: masked,
      providerMessageId: messageId,
      attemptedAt: new Date(),
    };
  }
}
