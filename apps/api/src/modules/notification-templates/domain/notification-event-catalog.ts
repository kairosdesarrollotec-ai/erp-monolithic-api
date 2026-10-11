/**
 * ADM-05 - catalogo de eventos que pueden tener plantilla. Solo se
 * listan eventos que YA se publican de verdad en outbox_events y que
 * ademas generan una notificacion in-app real (action: 'CREATE' en el
 * projector). Los eventos que devuelven IGNORE (ContratoFirmado.v1,
 * EntregaCompletada.v1, FaltaGraveAmpliacionRegistrada.v1,
 * DevolucionCompletada.v1) no se incluyen — no tiene sentido configurar
 * una plantilla para ellos si el relay los descarta.
 *
 * Referencias de publicacion:
 *   Reservations: convert-to-reservation.handler.ts, confirm-reservation.handler.ts,
 *                 cancel-reservation.handler.ts
 *   Recruitment:  decide-candidate.handler.ts, complete-onboarding.handler.ts
 *   HR-Admin:     terminate-employment.handler.ts
 */
export interface NotificationEventDescriptor {
  eventType: string;
  label: string;
}

export const NOTIFICATION_EVENT_CATALOG: readonly NotificationEventDescriptor[] = [
  { eventType: 'ReservationCreated', label: 'Reserva creada' },
  { eventType: 'ReservationConfirmed', label: 'Reserva confirmada' },
  { eventType: 'ReservationCancelled', label: 'Reserva cancelada' },
  { eventType: 'CandidatoSeleccionado.v1', label: 'Candidato seleccionado' },
  { eventType: 'PersonalIncorporado.v1', label: 'Personal incorporado' },
  { eventType: 'RelacionLaboralTerminada.v1', label: 'Relacion laboral terminada' },
];

export function isKnownEventType(eventType: string): boolean {
  return NOTIFICATION_EVENT_CATALOG.some((descriptor) => descriptor.eventType === eventType);
}
