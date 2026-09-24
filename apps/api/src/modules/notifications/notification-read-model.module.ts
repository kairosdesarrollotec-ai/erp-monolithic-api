import { Module } from '@nestjs/common';
import { NotificationReadModelPort } from './application/ports/notification-read-model.port';
import { PrismaNotificationReadModelRepository } from './infrastructure/persistence/prisma-notification-read-model.repository';

/**
 * TR-07 - solo el puerto/repositorio de la proyeccion de notificaciones,
 * sin ningun handler HTTP. Se separa de NotificationsModule (que trae
 * el controller + GetMyNotificationsHandler/MarkAllNotificationsReadHandler,
 * y por eso importa UsersModule para usar WorkContextAuthorizationService)
 * para evitar un ciclo de modulos: UsersModule ya importa
 * DashboardProjectionsModule (para GetDashboardHandler/TR-06), y
 * DashboardProjectionsModule necesita este puerto para su proyeccion de
 * TR-07 (ver outbox-relay.service.ts) - si DashboardProjectionsModule
 * importara el NotificationsModule completo (que a su vez importa
 * UsersModule), el ciclo seria: UsersModule -> DashboardProjectionsModule
 * -> NotificationsModule -> UsersModule. Este modulo, sin dependencias,
 * corta el ciclo.
 */
@Module({
  providers: [{ provide: NotificationReadModelPort, useClass: PrismaNotificationReadModelRepository }],
  exports: [NotificationReadModelPort],
})
export class NotificationReadModelModule {}
