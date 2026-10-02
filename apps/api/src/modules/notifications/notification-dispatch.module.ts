import { Module } from '@nestjs/common';
import { NotificationDispatcherPort } from './application/ports/notification-dispatcher.port';
import { NotificationDispatcherService } from './application/services/notification-dispatcher.service';
import { RecipientContactLookupPort } from './application/ports/recipient-contact-lookup.port';
import { FirebaseRecipientContactLookupAdapter } from './infrastructure/adapters/firebase-recipient-contact-lookup.adapter';
import {
  EmailNotificationPort,
  PushNotificationPort,
  SmsNotificationPort,
} from './application/ports/channel-notification.port';
import { FirebasePushNotificationAdapter } from './infrastructure/adapters/firebase-push-notification.adapter';
import { ConsoleEmailNotificationAdapter } from './infrastructure/adapters/console-email-notification.adapter';
import { ConsoleSmsNotificationAdapter } from './infrastructure/adapters/console-sms-notification.adapter';

/**
 * TR-07 — Módulo autónomo para el despacho externo de notificaciones (Email, Push, SMS).
 * Aislado de UsersModule para evitar ciclos de importación:
 * UsersModule -> DashboardProjectionsModule -> NotificationDispatchModule.
 */
@Module({
  providers: [
    {
      provide: NotificationDispatcherPort,
      useClass: NotificationDispatcherService,
    },
    {
      provide: RecipientContactLookupPort,
      useClass: FirebaseRecipientContactLookupAdapter,
    },
    {
      provide: PushNotificationPort,
      useClass: FirebasePushNotificationAdapter,
    },
    {
      provide: EmailNotificationPort,
      useClass: ConsoleEmailNotificationAdapter,
    },
    {
      provide: SmsNotificationPort,
      useClass: ConsoleSmsNotificationAdapter,
    },
  ],
  exports: [
    NotificationDispatcherPort,
    RecipientContactLookupPort,
    EmailNotificationPort,
    PushNotificationPort,
    SmsNotificationPort,
  ],
})
export class NotificationDispatchModule {}
