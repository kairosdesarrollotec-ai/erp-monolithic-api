import { Injectable } from '@nestjs/common';
import { IncidentDetailRecord } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentTransitionService } from '../services/incident-transition.service';
import { requireText } from '../../domain/incident-rules';
import { ReferIncidentToLegalCommand } from './refer-incident-to-legal.command';

/** Deriva la incidencia a via legal (estado terminal VIA_LEGAL): exige motivo y agrega la entrada REFERRED_LEGAL. */
@Injectable()
export class ReferIncidentToLegalHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly transitions: IncidentTransitionService,
  ) {}

  async execute(command: ReferIncidentToLegalCommand): Promise<IncidentDetailRecord> {
    const access = await this.access.authorize(command, 'REFER_LEGAL');
    const reason = requireText(command.reason, 'reason');
    return this.transitions.run({
      id: command.id,
      firebaseUid: command.firebaseUid,
      expectedVersion: command.expectedVersion,
      access,
      kind: 'REFERRED_LEGAL',
      description: reason,
      nextStatus: 'VIA_LEGAL',
      decision: command.decision,
      validateDecision: true,
      auditAction: 'INCIDENT_REFERRED_LEGAL',
      auditChanges: { reason },
      eventType: 'IncidentReferredToLegal.v1',
    });
  }
}
