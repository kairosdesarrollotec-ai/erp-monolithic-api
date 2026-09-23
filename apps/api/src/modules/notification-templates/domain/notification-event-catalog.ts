/**
 * ADM-05 - catalogo de eventos que pueden tener plantilla. Solo se
 * listan eventos que YA se publican de verdad en outbox_events
 * (ver convert-to-reservation.handler.ts, confirm-reservation.handler.ts,
 * cancel-reservation.handler.ts) - no se inventan eventos que el
 * sistema todavia no emite.
 */
export interface NotificationEventDescriptor {
  eventType: string;
  label: string;
}

export const NOTIFICATION_EVENT_CATALOG: readonly NotificationEventDescriptor[] = [
  { eventType: 'ReservationCreated', label: 'Reserva creada' },
  { eventType: 'ReservationConfirmed', label: 'Reserva confirmada' },
  { eventType: 'ReservationCancelled', label: 'Reserva cancelada' },
];

export function isKnownEventType(eventType: string): boolean {
  return NOTIFICATION_EVENT_CATALOG.some((descriptor) => descriptor.eventType === eventType);
}
