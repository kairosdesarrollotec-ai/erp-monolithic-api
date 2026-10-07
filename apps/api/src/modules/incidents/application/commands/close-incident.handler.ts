import { Injectable } from '@nestjs/common';
import { IncidentDetailRecord } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentTransitionService } from '../services/incident-transition.service';
import { requireText } from '../../domain/incident-rules';
import { CloseIncidentCommand } from './close-incident.command';

/**
 * INC-02 "Cerrar incidencia": exige resumen de resolucion (cualquier severidad). Deja la incidencia CERRADA y agrega la
 * entrada CLOSED al historial. Al cerrarse deja de bloquear la liberacion de garantia (DEV-09).
 */
@Injectable()
export class CloseIncidentHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly transitions: IncidentTransitionService,
  ) {}

  async execute(command: CloseIncidentCommand): Promise<IncidentDetailRecord> {
    const access = await this.access.authorize(command, 'CLOSE');
    const resolutionSummary = requireText(command.resolutionSummary, 'resolutionSummary');
    return this.transitions.run({
      id: command.id,
      firebaseUid: command.firebaseUid,
      expectedVersion: command.expectedVersion,
      access,
      kind: 'CLOSED',
      description: resolutionSummary,
      nextStatus: 'CERRADA',
      resolutionSummary,
      auditAction: 'INCIDENT_CLOSED',
      auditChanges: { resolutionSummary },
      eventType: 'IncidentClosed.v1',
    });
  }
}
