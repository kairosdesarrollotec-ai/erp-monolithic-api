import { renderNotificationTemplate } from '../../notification-templates/domain/notification-template-renderer';

export interface OutboxEventLike {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}

export interface NotificationProjectionInput {
  organizationId: string;
  companyId: string;
  branchId: string;
  recipientFirebaseUid: string;
  notificationType: string;
  title: string;
  deepLink: string;
  sourceEventId: string;
}

export type NotificationProjectionResult = { action: 'CREATE'; item: NotificationProjectionInput } | { action: 'IGNORE' };

interface ReservationCreatedPayload {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehicleId: string;
  startAt: string | Date;
  createdBy: string;
}

interface ReservationConfirmedPayload {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  confirmedBy: string;
}

interface ReservationCancelledPayload {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  reason: string;
  cancelledBy: string;
}

const FALLBACK_TEMPLATES: Record<string, string> = {
  ReservationCreated: 'Reserva creada para el vehiculo {vehiculo}, del {fecha}.',
  ReservationConfirmed: 'Tu reserva fue confirmada.',
  ReservationCancelled: 'Tu reserva fue cancelada ({motivo}).',
};

/**
 * TR-07 - convierte un evento de outbox_events en una notificacion de
 * lectura para su destinatario. Reutiliza el texto configurado en
 * ADM-05 (NotificationTemplatePort) cuando existe una plantilla
 * guardada para el evento; si nunca se guardo una, usa un texto
 * generico de respaldo (FALLBACK_TEMPLATES) en vez de dejar al usuario
 * sin ninguna notificacion.
 *
 * ALCANCE REAL: el destinatario es siempre el actor de la accion
 * (createdBy/confirmedBy/cancelledBy) - ver la nota completa en el
 * modelo NotificationReadModel (schema.prisma).
 */
export function projectNotificationEvent(
  event: OutboxEventLike,
  templateBody: string | null,
): NotificationProjectionResult {
  switch (event.eventType) {
    case 'ReservationCreated': {
      const payload = event.payload as ReservationCreatedPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES.ReservationCreated;
      const title = renderNotificationTemplate(body, {
        vehiculo: payload.vehicleId,
        fecha: new Date(payload.startAt).toLocaleDateString('es-PE'),
      });
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.createdBy, title);
    }
    case 'ReservationConfirmed': {
      const payload = event.payload as ReservationConfirmedPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES.ReservationConfirmed;
      const title = renderNotificationTemplate(body, {});
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.confirmedBy, title);
    }
    case 'ReservationCancelled': {
      const payload = event.payload as ReservationCancelledPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES.ReservationCancelled;
      const title = renderNotificationTemplate(body, { motivo: payload.reason });
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.cancelledBy, title);
    }
    default:
      return { action: 'IGNORE' };
  }
}

function buildCreate(
  event: OutboxEventLike,
  organizationId: string,
  companyId: string,
  branchId: string,
  recipientFirebaseUid: string,
  title: string,
): NotificationProjectionResult {
  return {
    action: 'CREATE',
    item: {
      organizationId,
      companyId,
      branchId,
      recipientFirebaseUid,
      notificationType: event.eventType,
      title,
      deepLink: `/reservas/${event.aggregateId}`,
      sourceEventId: event.id,
    },
  };
}
