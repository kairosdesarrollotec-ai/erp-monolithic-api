import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelDeliveryResult,
  ChannelNotificationPayload,
  computeOverallDeliveryStatus,
  ExternalNotificationDispatchResult,
  maskEmail,
  maskPhoneNumber,
} from '../../domain/external-notification';
import {
  DispatchNotificationInput,
  NotificationDispatcherPort,
} from '../ports/notification-dispatcher.port';
import { RecipientContactLookupPort } from '../ports/recipient-contact-lookup.port';
import {
  EmailNotificationPort,
  PushNotificationPort,
  SmsNotificationPort,
} from '../ports/channel-notification.port';

@Injectable()
export class NotificationDispatcherService
  implements NotificationDispatcherPort
{
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly contactLookup: RecipientContactLookupPort,
    private readonly emailSender: EmailNotificationPort,
    private readonly pushSender: PushNotificationPort,
    private readonly smsSender: SmsNotificationPort,
  ) {}

  async dispatch(
    input: DispatchNotificationInput,
  ): Promise<ExternalNotificationDispatchResult> {
    const { channels, recipientFirebaseUid, sourceEventId } = input;

    if (!channels || channels.length === 0) {
      return {
        sourceEventId,
        recipientId: recipientFirebaseUid,
        deliveries: [],
        overallStatus: 'ALL_SKIPPED',
        dispatchedAt: new Date(),
      };
    }

    let contact = null;
    try {
      contact = await this.contactLookup.lookupContact(recipientFirebaseUid, input.organizationId);
    } catch (err) {
      this.logger.warn(
        `Failed to resolve contact info for uid=${recipientFirebaseUid.slice(0, 6)}...: ${(err as Error).message}`,
      );
    }

    const resolvedContact = contact ?? {
      recipientId: recipientFirebaseUid,
      email: null,
      phoneNumber: null,
      pushTokens: [],
      displayName: null,
    };

    const payload: ChannelNotificationPayload = {
      sourceEventId,
      organizationId: input.organizationId,
      companyId: input.companyId,
      branchId: input.branchId,
      eventType: input.eventType,
      recipient: resolvedContact,
      title: input.title,
      body: input.body,
      deepLink: input.deepLink,
      metadata: input.metadata,
    };

    const deliveryPromises = channels.map(
      async (channel): Promise<ChannelDeliveryResult> => {
        try {
          switch (channel) {
            case 'EMAIL':
              if (!resolvedContact.email) {
                return {
                  channel: 'EMAIL',
                  status: 'SKIPPED',
                  recipientTarget: 'none',
                  reason: 'RECIPIENT_EMAIL_NOT_CONFIGURED',
                  attemptedAt: new Date(),
                };
              }
              return await this.emailSender.send(payload);

            case 'PUSH':
              if (resolvedContact.pushTokens.length === 0) {
                return {
                  channel: 'PUSH',
                  status: 'SKIPPED',
                  recipientTarget: 'none',
                  reason: 'RECIPIENT_PUSH_TOKEN_NOT_CONFIGURED',
                  attemptedAt: new Date(),
                };
              }
              return await this.pushSender.send(payload);

            case 'SMS':
              if (!resolvedContact.phoneNumber) {
                return {
                  channel: 'SMS',
                  status: 'SKIPPED',
                  recipientTarget: 'none',
                  reason: 'RECIPIENT_PHONE_NOT_CONFIGURED',
                  attemptedAt: new Date(),
                };
              }
              return await this.smsSender.send(payload);

            default:
              return {
                channel,
                status: 'SKIPPED',
                recipientTarget: 'unknown',
                reason: `UNKNOWN_CHANNEL_${channel}`,
                attemptedAt: new Date(),
              };
          }
        } catch (channelErr) {
          this.logger.error(
            `Unexpected exception dispatching channel ${channel} for event ${sourceEventId}: ${(channelErr as Error).message}`,
            (channelErr as Error).stack,
          );
          return {
            channel,
            status: 'FAILED',
            recipientTarget:
              channel === 'EMAIL'
                ? maskEmail(resolvedContact.email)
                : maskPhoneNumber(resolvedContact.phoneNumber),
            error: {
              code: 'CHANNEL_EXCEPTION',
              message: (channelErr as Error).message,
            },
            attemptedAt: new Date(),
          };
        }
      },
    );

    const deliveries = await Promise.all(deliveryPromises);
    const overallStatus = computeOverallDeliveryStatus(deliveries);

    this.logger.log(
      `Dispatched notifications for event=${sourceEventId} recipient=${recipientFirebaseUid.slice(0, 6)}... channels=[${channels.join(',')}] status=${overallStatus}`,
    );

    return {
      sourceEventId,
      recipientId: recipientFirebaseUid,
      deliveries,
      overallStatus,
      dispatchedAt: new Date(),
    };
  }
}
