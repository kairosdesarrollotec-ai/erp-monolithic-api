import { Injectable } from '@nestjs/common';
import { IncidentRecord, IncidentRepositoryPort } from '../ports/incident-repository.port';
import { IncidentAccessService } from '../services/incident-access.service';
import { ListIncidentsQuery } from './list-incidents.query';

/** INC-01 - bandeja con filtros (tipo, severidad, estado, alquiler, devolucion) y paginacion keyset. */
@Injectable()
export class ListIncidentsHandler {
  constructor(
    private readonly access: IncidentAccessService,
    private readonly incidents: IncidentRepositoryPort,
  ) {}

  async execute(query: ListIncidentsQuery): Promise<IncidentRecord[]> {
    const { scope } = await this.access.authorize(query, 'VIEW');
    return this.incidents.list({
      ...scope,
      type: query.type,
      severity: query.severity,
      status: query.status,
      rentalId: query.rentalId,
      returnId: query.returnId,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
