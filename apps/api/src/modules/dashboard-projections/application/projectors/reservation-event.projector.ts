import type { UpsertDashboardItemInput } from '../ports/dashboard-item-repository.port';

export interface OutboxEventLike {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}

export type ReservationProjectionResult =
  | { action: 'UPSERT'; item: UpsertDashboardItemInput }
  | { action: 'DISMISS'; sourceType: string; sourceId: string }
  | { action: 'IGNORE' };

interface ReservationCreatedPayload {
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
  vehicleId: string;
  startAt: string | Date;
  endAt: string | Date;
}

/**
 * Reglas de priorizacion por rol para eventos de Reservations
 * (PANTALLAS-V3-B-TRANSVERSAL.md, vista Front-office: "Continuar donde
 * quedaste" / reservas por vencer). Alcance real de esta primera version
 * (23 sep 2026): solo Front-office, solo el ciclo de vida de la propia
 * Reserva (creada -> pendiente de pago/documentos -> confirmada o
 * cancelada). No modela todavia "reservas que vencen hoy" (requiere un
 * job programado por fecha, no solo eventos) ni las vistas de
 * Gerencia/Finanzas/RR.HH./Campo (dependen de Rentals/Returns/
 * Recruitment/HR-Administration, que todavia no existen como modulos de
 * backend) - ver claude/Diseno_Agregador_Transversal_TR-06-07-08.md
 * (Project KAIROS) para el diseno completo, del que esta es la primera
 * porcion real e implementada.
 */
export function projectReservationEvent(event: OutboxEventLike): ReservationProjectionResult {
  switch (event.eventType) {
    case 'ReservationCreated': {
      const payload = event.payload as ReservationCreatedPayload;
      return {
        action: 'UPSERT',
        item: {
          organizationId: payload.organizationId,
          operatingCompanyId: payload.operatingCompanyId,
          branchId: payload.branchId,
          role: 'FRONT_OFFICE',
          itemType: 'TASK',
          priority: 10,
          title: `Reserva pendiente de pago/documentos`,
          detail: `Vehiculo ${payload.vehicleId}`,
          deepLink: `/reservations/${event.aggregateId}`,
          sourceType: 'RESERVATION',
          sourceId: event.aggregateId,
          sourceEventId: event.id,
        },
      };
    }
    case 'ReservationConfirmed':
    case 'ReservationCancelled':
      // La reserva ya no requiere atencion pendiente - se descarta el
      // TASK que genero su creacion (regla UX: "un widget sin datos no
      // ocupa espacio", TR-06 punto 17 del contrato).
      return { action: 'DISMISS', sourceType: 'RESERVATION', sourceId: event.aggregateId };
    default:
      return { action: 'IGNORE' };
  }
}
