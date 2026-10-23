import { Injectable, Logger } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { FieldTripCascadeService } from '../services/field-trip-cascade.service';
import { FieldTripAlertPublisher } from '../services/field-trip-alert.publisher';
import { FieldTripRepositoryPort } from '../ports/field-trip-repository.port';
import { FieldTripNotPendingError } from '../../domain/hr-administration-errors';

/** Actor de auditoría de las escalaciones automáticas por vencimiento del temporizador (NFR-BIZ-008). */
export const FIELD_TRIP_SCHEDULER_ACTOR = 'system:field-trip-scheduler';

export const MAX_ESCALATIONS_PER_RUN = 200;

export interface ProcessDueFieldTripTimeoutsResult {
  escalated: number;
  notAuthorized: number;
}

/**
 * ADP-P13 / BR-ADP-004 / NFR-BIZ-008: avanza SOLO la cascada de salidas a campo cuyo temporizador de 5 min venció
 * (N1 -> N2 -> N3 -> NO_AUTORIZADA), sin que nadie tenga la cola abierta. Cada escalación es una transacción propia que
 * reclama la fila con `FOR UPDATE SKIP LOCKED`: con varias réplicas de la API, dos procesos nunca avanzan la misma
 * salida, y repetir la ejecución es inocuo (una salida ya avanzada deja de estar vencida). El vencimiento del nivel
 * siguiente se cuenta desde el del anterior, así que un retraso del programador no alarga los 3 x 5 min. No existe 4to
 * nivel: tras el 3º queda NO_AUTORIZADA (nunca se aprueba por defecto).
 */
@Injectable()
export class ProcessDueFieldTripTimeoutsHandler {
  private readonly logger = new Logger(ProcessDueFieldTripTimeoutsHandler.name);

  constructor(
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly cascade: FieldTripCascadeService,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly alerts: FieldTripAlertPublisher,
  ) {}

  async execute(): Promise<ProcessDueFieldTripTimeoutsResult> {
    const result: ProcessDueFieldTripTimeoutsResult = { escalated: 0, notAuthorized: 0 };

    for (let i = 0; i < MAX_ESCALATIONS_PER_RUN; i += 1) {
      const outcome = await this.escalateNext();
      if (outcome === null) break;
      if (outcome === 'SKIPPED') continue;
      if (outcome === 'NO_AUTORIZADA') result.notAuthorized += 1;
      result.escalated += 1;
    }

    if (result.escalated > 0) {
      this.logger.log(
        `Cascada de salidas a campo: ${result.escalated} escalación(es) por vencimiento, ${result.notAuthorized} sin autorización.`,
      );
    }
    return result;
  }

  /** Escala una salida vencida; devuelve su nuevo estado o null si ya no queda ninguna vencida. */
  private async escalateNext(): Promise<string | null> {
    return this.transactionManager.run(async (tx) => {
      const now = this.clock.now();
      const id = await this.fieldTrips.claimNextDueForEscalation(now, tx);
      if (!id) return null;

      const before = await this.fieldTrips.findById(id, tx);
      if (!before) return null;

      try {
        const { fieldTrip } = await this.cascade.advanceTimeout({ fieldTripId: id, now }, tx);
        await this.auditRepository.recordHrAdministrationEvent(
          {
            organizationId: before.employee.organizationId,
            actorUserId: FIELD_TRIP_SCHEDULER_ACTOR,
            entityType: 'field_trip',
            entityId: fieldTrip.id,
            action: fieldTrip.status === 'NO_AUTORIZADA' ? 'FIELD_TRIP_NOT_AUTHORIZED' : 'FIELD_TRIP_ESCALATED',
            changes: {
              employeeId: fieldTrip.employeeId,
              previousStatus: before.status,
              status: fieldTrip.status,
              level2TimeoutAt: fieldTrip.level2TimeoutAt,
              level3TimeoutAt: fieldTrip.level3TimeoutAt,
              automatic: true,
            },
          },
          tx,
        );
        await this.alerts.publish(
          fieldTrip.status === 'NO_AUTORIZADA' ? 'NOT_AUTHORIZED' : 'ESCALATED',
          fieldTrip,
          before.employee,
          tx,
          { previousStatus: before.status, automatic: true },
        );
        return fieldTrip.status;
      } catch (error) {
        // Otra instancia/operación la resolvió justo antes (autorizada, rechazada o ya escalada): no es un error.
        if (error instanceof FieldTripNotPendingError) return 'SKIPPED';
        throw error;
      }
    });
  }
}
