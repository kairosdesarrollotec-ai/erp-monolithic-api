import { Injectable } from '@nestjs/common';
import { IncidentDetailRecord, IncidentRepositoryPort } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { IncidentNotFoundError } from '../../domain/incident-errors';
import { GetIncidentQuery } from './get-incident.query';

/** INC-02 - detalle con timeline. Una incidencia de otra empresa/sede responde 404, nunca 403 (no revela existencia). */
@Injectable()
export class GetIncidentHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly incidents: IncidentRepositoryPort,
  ) {}

  async execute(query: GetIncidentQuery): Promise<IncidentDetailRecord> {
    const { scope } = await this.access.authorize(query, 'VIEW');
    const found = await this.incidents.findById(query.id, scope);
    if (!found) {
      throw new IncidentNotFoundError(query.id);
    }
    return found;
  }
}
