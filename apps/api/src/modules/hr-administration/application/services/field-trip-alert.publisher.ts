import { Injectable } from '@nestjs/common';
import type { FieldTripRequest, FieldTripStatus, Prisma } from '@prisma/client';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';

export type FieldTripAlertKind = 'REQUESTED' | 'ESCALATED' | 'NOT_AUTHORIZED' | 'RESOLVED';

const EVENT_TYPE: Record<FieldTripAlertKind, string> = {
  REQUESTED: 'SalidaCampoSolicitada.v1',
  ESCALATED: 'SalidaCampoEscalada.v1',
  NOT_AUTHORIZED: 'SalidaCampoNoAutorizada.v1',
  RESOLVED: 'SalidaCampoResuelta.v1',
};

export interface FieldTripAlertEmployee {
  id: string;
  fullName: string;
  organizationId: string;
  operatingCompanyId: string;
  branchId: string;
}

/** Nivel de la cascada (1..3) que corresponde a un estado pendiente; null si no es pendiente. */
export function fieldTripLevelOfStatus(status: FieldTripStatus): number | null {
  if (status === 'PENDIENTE_NIVEL_1') return 1;
  if (status === 'PENDIENTE_NIVEL_2') return 2;
  if (status === 'PENDIENTE_NIVEL_3') return 3;
  return null;
}

/**
 * Respuestas 2026-10-22 #4: la cascada de salidas a campo publica por outbox (en la MISMA transaccion que el cambio de estado) los
 * eventos que el tablero proyecta a quienes tienen NOTIFICATIONS.RECEIVE_FIELD_TRIP_ALERTS (v0 = Gerencia): solicitud creada
 * (SalidaCampoSolicitada.v1), escalada de nivel (SalidaCampoEscalada.v1), nadie autorizo (SalidaCampoNoAutorizada.v1, deep link
 * /personal/campo) y salida resuelta -autorizada o rechazada- (SalidaCampoResuelta.v1, que retira los avisos pendientes de esa salida).
 * El payload no lleva datos personales mas alla del nombre del colaborador y el destino.
 */
@Injectable()
export class FieldTripAlertPublisher {
  constructor(private readonly outbox: OutboxEventRepositoryPort) {}

  async publish(
    kind: FieldTripAlertKind,
    fieldTrip: Pick<FieldTripRequest, 'id' | 'employeeId' | 'destination' | 'status'>,
    employee: FieldTripAlertEmployee,
    tx: Prisma.TransactionClient,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.outbox.publish(
      {
        aggregateType: 'FieldTripRequest',
        aggregateId: fieldTrip.id,
        eventType: EVENT_TYPE[kind],
        payload: {
          fieldTripId: fieldTrip.id,
          employeeId: employee.id,
          employeeName: employee.fullName,
          destination: fieldTrip.destination,
          status: fieldTrip.status,
          level: fieldTripLevelOfStatus(fieldTrip.status),
          deepLink: '/personal/campo',
          organizationId: employee.organizationId,
          operatingCompanyId: employee.operatingCompanyId,
          branchId: employee.branchId,
          ...extra,
        },
      },
      tx,
    );
  }
}
