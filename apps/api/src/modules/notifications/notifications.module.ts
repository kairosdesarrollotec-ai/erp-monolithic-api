import { Module } from '@nestjs/common';
import { NotificationsController } from './presentation/http/notifications.controller';
import { GetMyNotificationsHandler } from './application/queries/get-my-notifications.handler';
import { MarkAllNotificationsReadHandler } from './application/commands/mark-all-notifications-read.handler';
import { NotificationReadModelModule } from './notification-read-model.module';
import { UsersModule } from '../users/users.module';

/**
 * TR-07 (Centro de notificaciones) - controller + handlers HTTP. Ver
 * claude/Diseno_Agregador_Transversal_TR-06-07-08.md (Project KAIROS)
 * para el diseno completo del agregador que comparte con TR-06/TR-08.
 * El puerto de escritura (usado por OutboxRelayService en
 * dashboard-projections para proyectar notificaciones desde el outbox)
 * vive en NotificationReadModelModule, no aqui - ver la nota de esa
 * separacion en ese archivo (evita un ciclo de modulos con UsersModule).
 */
@Module({
  imports: [UsersModule, NotificationReadModelModule],
  controllers: [NotificationsController],
  providers: [GetMyNotificationsHandler, MarkAllNotificationsReadHandler],
})
export class NotificationsModule {}
