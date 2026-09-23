import type { Prisma } from '@prisma/client';
import type { NotificationChannel } from '../../domain/notification-variable-catalog';

export interface NotificationTemplateSnapshot {
  eventType: string;
  version: number;
  channels: NotificationChannel[];
  body: string;
}

export interface CreateNotificationTemplateVersionInput {
  eventType: string;
  channels: NotificationChannel[];
  body: string;
}

/**
 * ADM-05. Ver la nota de alcance real en el modelo Prisma
 * (NotificationTemplateVersion): esto guarda texto/canal de la
 * plantilla, no envia ninguna notificacion.
 */
export abstract class NotificationTemplatePort {
  /**
   * Plantilla vigente para un evento. Si nunca se guardo una, no hay
   * "version 0 implicita" (a diferencia de ADM-02/ADM-03) porque no
   * existe un texto por defecto razonable para inventar - se devuelve
   * null y la pantalla lo trata como plantilla vacia.
   */
  abstract getCurrent(organizationId: string, eventType: string): Promise<NotificationTemplateSnapshot | null>;

  abstract listHistory(organizationId: string, eventType: string): Promise<NotificationTemplateSnapshot[]>;

  abstract createVersion(
    organizationId: string,
    input: CreateNotificationTemplateVersionInput,
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationTemplateSnapshot>;
}
