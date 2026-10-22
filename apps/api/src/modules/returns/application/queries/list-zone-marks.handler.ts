import { Injectable } from '@nestjs/common';
import { ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnZoneMarkRepositoryPort } from '../ports/return-zone-mark-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { deriveRouteTaken } from '../../domain/return-zone-marks';
import type { RecordZoneMarksResult } from '../commands/record-zone-marks.handler';
import { ListZoneMarksQuery } from './list-zone-marks.query';

/** DEV-05 / PD-07: lee las marcas por zona persistidas (restaura la pantalla Resultado en otro dispositivo o tras recargar). */
@Injectable()
export class ListZoneMarksHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    private readonly zoneMarks: ReturnZoneMarkRepositoryPort,
  ) {}

  async execute(query: ListZoneMarksQuery): Promise<RecordZoneMarksResult> {
    const { scope } = await this.access.authorize(query, 'READ');
    const existing = await this.returns.findById(query.id, scope);
    if (!existing) {
      throw new ReturnNotFoundError(query.id);
    }
    const marks = await this.zoneMarks.list(query.id);
    const route = deriveRouteTaken(marks);
    return { returnId: query.id, marks, complete: route !== null, route };
  }
}
