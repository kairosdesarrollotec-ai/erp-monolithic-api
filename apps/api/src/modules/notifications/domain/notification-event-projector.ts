import { renderNotificationTemplate } from '../../notification-templates/domain/notification-template-renderer';
import { formatLimaDMY, parseBusinessInstant } from '../../../common/time/lima-time';

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

// Payloads de Rentals — no incluyen organizationId/branchId ni actor,
// por lo que estos eventos devuelven IGNORE en la proyeccion in-app.
// El claimBatch los reclamara y el relay los marcara como procesados
// sin crear notificacion.

// Payloads de Returns — incluyen organizationId/branchId pero no actor/recipient.
interface _DevolucionCompletadaPayload {
  returnId: string;
  rentalId: string;
  vehicleId: string;
  customerId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  closedAt: string;
}

// Payloads de Recruitment — incluyen contexto de tenant y actor.
interface CandidatoSeleccionadoPayload {
  candidateId: string;
  vacancyId: string;
  fullName: string;
  documentNumber: string;
  decision: string;
  decidedAt: string;
  decidedBy: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

// Payloads de HR-Administration — incluyen contexto de tenant y actor.
interface PersonalIncorporadoPayload {
  candidateId: string;
  vacancyId: string;
  startDate: string;
  isMechanic: boolean;
  completedAt: string;
  actorUserId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

interface RelacionLaboralTerminadaPayload {
  employeeId: string;
  terminationId: string;
  reason: string;
  noticeDays: number;
  terminatedAt: string;
  areaId: string;
  areaName: string;
  jobTitle: string;
  actorUserId: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

interface ReservationCreatedPayload {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehicleId: string;
  startAt: string;
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
  'CandidatoSeleccionado.v1': 'Candidato {nombre} seleccionado.',
  'PersonalIncorporado.v1': 'Nuevo personal incorporado desde el {fecha}.',
  'RelacionLaboralTerminada.v1': 'Relacion laboral terminada ({motivo}).',
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
        fecha: formatLimaDMY(parseBusinessInstant(String(payload.startAt))),
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

    // Rentals — payloads sin organizationId ni actor; se procesan y se ignoran
    // para la proyeccion in-app. El relay los marca como procesados normalmente.
    case 'ContratoFirmado.v1':
    case 'EntregaCompletada.v1':
    case 'FaltaGraveAmpliacionRegistrada.v1':
      return { action: 'IGNORE' };

    // Returns — tiene contexto de tenant pero no incluye actor/recipient en el payload.
    case 'DevolucionCompletada.v1':
      return { action: 'IGNORE' };

    // Recruitment — candidato seleccionado (decision CONTRATADO).
    case 'CandidatoSeleccionado.v1': {
      const payload = event.payload as CandidatoSeleccionadoPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES['CandidatoSeleccionado.v1'];
      const title = renderNotificationTemplate(body, { nombre: payload.fullName });
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.decidedBy, title, '/reclutamiento');
    }

    // HR-Administration — personal incorporado tras onboarding completo.
    case 'PersonalIncorporado.v1': {
      const payload = event.payload as PersonalIncorporadoPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES['PersonalIncorporado.v1'];
      const title = renderNotificationTemplate(body, {
        fecha: formatLimaDMY(parseBusinessInstant(String(payload.startDate))),
      });
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.actorUserId, title, '/personal');
    }

    // HR-Administration — relacion laboral terminada.
    case 'RelacionLaboralTerminada.v1': {
      const payload = event.payload as RelacionLaboralTerminadaPayload;
      const body = templateBody ?? FALLBACK_TEMPLATES['RelacionLaboralTerminada.v1'];
      const title = renderNotificationTemplate(body, { motivo: payload.reason });
      return buildCreate(event, payload.organizationId, payload.operatingCompanyId, payload.branchId, payload.actorUserId, title, '/personal');
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
  deepLink?: string,
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
      deepLink: deepLink ?? `/reservas/${event.aggregateId}`,
      sourceEventId: event.id,
    },
  };
}
