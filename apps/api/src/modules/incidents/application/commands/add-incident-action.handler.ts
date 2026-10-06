import { Injectable } from '@nestjs/common';
import { IncidentDetailRecord } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentTransitionService } from '../services/incident-transition.service';
import { requireText } from '../../domain/incident-rules';
import { AddIncidentActionCommand } from './add-incident-action.command';

/** INC-02 "Agregar nueva accion": agrega una entrada ACTION al historial append-only; la incidencia sigue ABIERTA. */
@Injectable()
export class AddIncidentActionHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly transitions: IncidentTransitionService,
  ) {}

  async execute(command: AddIncidentActionCommand): Promise<IncidentDetailRecord> {
    const access = await this.access.authorize(command, 'ADD_ACTION');
    const description = requireText(command.description, 'description');
    return this.transitions.run({
      id: command.id,
      firebaseUid: command.firebaseUid,
      expectedVersion: command.expectedVersion,
      access,
      kind: 'ACTION',
      description,
      auditAction: 'INCIDENT_ACTION_ADDED',
      auditChanges: { description },
      eventType: 'IncidentActionAdded.v1',
    });
  }
}
