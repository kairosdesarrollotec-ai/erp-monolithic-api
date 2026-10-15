import { Injectable } from '@nestjs/common';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { OutboxEventRepositoryPort } from '../../../outbox/application/ports/outbox-event-repository.port';
import { IncidentDetailRecord, IncidentRepositoryPort } from '../ports/incident-repository.port';
import { IncidentLinksPort } from '../ports/incident-links.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentRentalNotFoundError, IncidentReturnNotFoundError } from '../../domain/incident-errors';
import { assertSeverityAllowedForType, requireText } from '../../domain/incident-rules';
import { CreateIncidentCommand } from './create-incident.command';

/**
 * INC-01 "Registrar incidencia". Crea la incidencia en ABIERTA ligada a un Alquiler (y opcionalmente a una Devolucion
 * del mismo alquiler) con su primera entrada REPORTED del historial. Auditoria (INCIDENT_REGISTERED) y outbox
 * (IncidentRegistered.v1) en la misma transaccion. Responsable por defecto: quien registra; fecha de reporte por
 * defecto: ahora.
 */
@Injectable()
export class CreateIncidentHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly incidents: IncidentRepositoryPort,
    private readonly links: IncidentLinksPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
    private readonly outboxRepository: OutboxEventRepositoryPort,
  ) {}

  async execute(command: CreateIncidentCommand): Promise<IncidentDetailRecord> {
    const { context, scope } = await this.access.authorize(command, 'CREATE');
    assertSeverityAllowedForType(command.type, command.severity);
    const description = requireText(command.description, 'description');
    const suggestion = command.suggestion?.trim() ? command.suggestion.trim() : undefined;
    const now = this.clock.now();
    const reportedAt = command.reportedAt ?? now;
    const responsibleUserId = command.responsibleUserId?.trim() || command.firebaseUid;

    return this.transactionManager.run(async (tx) => {
      const rental = await this.links.findRental(command.rentalId, scope, tx);
      if (!rental) {
        throw new IncidentRentalNotFoundError(command.rentalId);
      }
      if (command.returnId) {
        const rentalReturn = await this.links.findReturn(command.returnId, scope, tx);
        if (!rentalReturn) {
          throw new IncidentReturnNotFoundError(command.returnId);
        }
        if (rentalReturn.rentalId !== rental.id) {
          throw new IncidentReturnNotFoundError(
            command.returnId,
            `La devolucion ${command.returnId} no pertenece al alquiler ${rental.id}.`,
          );
        }
      }

      const created = await this.incidents.create(
        {
          ...scope,
          rentalId: rental.id,
          returnId: command.returnId,
          type: command.type,
          severity: command.severity,
          description,
          suggestion,
          reportedAt,
          responsibleUserId,
          createdBy: command.firebaseUid,
          now,
        },
        tx,
      );

      await this.auditRepository.recordIncidentEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          incidentId: created.id,
          action: 'INCIDENT_REGISTERED',
          changes: {
            rentalId: created.rentalId,
            returnId: created.returnId,
            type: created.type,
            severity: created.severity,
            reportedAt: created.reportedAt.toISOString(),
            responsibleUserId: created.responsibleUserId,
          },
        },
        tx,
      );
      await this.outboxRepository.publish(
        {
          aggregateType: 'incident',
          aggregateId: created.id,
          eventType: 'IncidentRegistered.v1',
          payload: {
            incidentId: created.id,
            rentalId: created.rentalId,
            returnId: created.returnId,
            type: created.type,
            severity: created.severity,
            status: created.status,
            reportedAt: created.reportedAt.toISOString(),
            responsibleUserId: created.responsibleUserId,
            organizationId: context.organizationId,
            operatingCompanyId: context.companyId,
            branchId: context.branchId,
          },
        },
        tx,
      );

      return created;
    });
  }
}
