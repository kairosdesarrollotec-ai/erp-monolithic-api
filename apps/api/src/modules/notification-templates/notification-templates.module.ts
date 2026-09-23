import { Module } from '@nestjs/common';
import { NotificationTemplatePort } from './application/ports/notification-template.port';
import { PrismaNotificationTemplateRepository } from './infrastructure/persistence/prisma-notification-template.repository';

/**
 * ADM-05 - configuracion de plantillas de notificacion. Ver la nota de
 * alcance real en NotificationTemplateVersion (schema.prisma): esto no
 * reemplaza ni construye TR-07 (el envio real de notificaciones).
 */
@Module({
  providers: [{ provide: NotificationTemplatePort, useClass: PrismaNotificationTemplateRepository }],
  exports: [NotificationTemplatePort],
})
export class NotificationTemplatesModule {}
