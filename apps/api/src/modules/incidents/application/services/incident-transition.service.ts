import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { IncidentDetailRecord, IncidentRepositoryPort } from '../ports/incident-repository.port';
import type { IncidentAccess } from './incident-access.service';
import type { IncidentActionKind, IncidentStatus } from '../../domain/incident-catalog';
import { IncidentNotFoundError } from '../../domain/incident-errors';
import { assertIncidentOpen } from '../../domain/incident-rules';

export interface IncidentTransitionParams {
  id: string;
  firebaseUid: string;
  expectedVersion: number;
  access: IncidentAccess;
  /** Tipo de la entrada append-only que se agrega al historial. */
  kind: IncidentActionKind;
  description: string;
  /** Si se indica, la incidencia deja ABIERTA y pasa a este estado terminal. */
  nextStatus?: IncidentStatus;
  /** CERRADA: resumen de resolucion + resolvedAt = ahora. */
  resolutionSummary?: string;
  /** Regla extra de dominio sobre la incidencia ya cargada (p. ej. resolucion directa solo LEVE). */
  guard?: (current: IncidentDetailRecord) => void;
  auditAction: string;
  auditChanges: Record<string, unknown>;
  eventType: string;
}

/**
 * Flujo comun de los comandos de transicion/accion sobre una incidencia ABIERTA (add-action, resolve, close,
 * refer-legal): en UNA transaccion relee la incidencia dentro del scope, exige ABIERTA, aplica la guarda de dominio,
 * agrega la entrada al historial (con If-Match/version optimista) y registra auditoria + outbox. Un fallo en
 * cualquier paso revierte todo.
 */
@Injectable()
export class IncidentTransitionService {
  constructor(
    private readonly incidents: IncidentRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async run(params: IncidentTransitionParams): Promise<IncidentDetailRecord> {
    const { context, scope } = params.access;
    const now = this.clock.now();

    return this.transactionManager.run(async (tx) => {
      const current = await this.incidents.findById(params.id, scope, tx);
      if (!current) {
        throw new IncidentNotFoundError(params.id);
      }
      assertIncidentOpen(current.status);
      params.guard?.(current);

      const { incident: updated, action } = await this.incidents.appendAction(
        {
          id: params.id,
          scope,
          expectedVersion: params.expectedVersion,
          kind: params.kind,
          description: params.description,
          authorUserId: params.firebaseUid,
          now,
          nextStatus: params.nextStatus,
          resolutionSummary: params.resolutionSummary,
          resolvedAt: params.resolutionSummary !== undefined ? now : undefined,
        },
        tx,
      );

      await this.auditRepository.recordIncidentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: params.firebaseUid,
          incidentId: updated.id,
          action: params.auditAction,
          changes: { actionId: action.id, ...params.auditChanges },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'incident',
          aggregateId: updated.id,
          eventType: params.eventType,
          payload: {
            incidentId: updated.id,
            rentalId: updated.rentalId,
            returnId: updated.returnId,
            type: updated.type,
            severity: updated.severity,
            status: updated.status,
            actionId: action.id,
            actionKind: action.kind,
            authorUserId: action.authorUserId,
            occurredAt: action.createdAt.toISOString(),
            resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return updated;
    });
  }
}
