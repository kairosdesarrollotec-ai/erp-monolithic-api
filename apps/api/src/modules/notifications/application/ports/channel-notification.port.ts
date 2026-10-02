import {
  ChannelDeliveryResult,
  ChannelNotificationPayload,
} from '../../domain/external-notification';

export abstract class EmailNotificationPort {
  abstract send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult>;
}

export abstract class PushNotificationPort {
  abstract send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult>;
}

export abstract class SmsNotificationPort {
  abstract send(
    payload: ChannelNotificationPayload,
  ): Promise<ChannelDeliveryResult>;
}
