import { Injectable } from '@nestjs/common';
import { IncidentDetailRecord } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentTransitionService } from '../services/incident-transition.service';
import { assertDirectResolveAllowed, requireText } from '../../domain/incident-rules';
import { ResolveIncidentCommand } from './resolve-incident.command';

/**
 * INC-01 "Resolver" directo desde la fila: solo severidad LEVE (si no, 422 INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED) y
 * exige resumen de resolucion. Deja la incidencia CERRADA y agrega la entrada RESOLVED al historial.
 */
@Injectable()
export class ResolveIncidentHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly transitions: IncidentTransitionService,
  ) {}

  async execute(command: ResolveIncidentCommand): Promise<IncidentDetailRecord> {
    const access = await this.access.authorize(command, 'RESOLVE');
    const resolutionSummary = requireText(command.resolutionSummary, 'resolutionSummary');
    return this.transitions.run({
      id: command.id,
      firebaseUid: command.firebaseUid,
      expectedVersion: command.expectedVersion,
      access,
      kind: 'RESOLVED',
      description: resolutionSummary,
      nextStatus: 'CERRADA',
      resolutionSummary,
      guard: (current) => assertDirectResolveAllowed(current.severity),
      auditAction: 'INCIDENT_RESOLVED',
      auditChanges: { resolutionSummary, direct: true },
      eventType: 'IncidentResolved.v1',
    });
  }
}
