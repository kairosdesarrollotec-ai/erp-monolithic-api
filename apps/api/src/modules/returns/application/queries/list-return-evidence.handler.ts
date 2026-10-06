import { Injectable } from '@nestjs/common';
import { ReturnEvidenceRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { ListReturnEvidenceQuery } from './list-return-evidence.query';

@Injectable()
export class ListReturnEvidenceHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
  ) {}

  async execute(query: ListReturnEvidenceQuery): Promise<ReturnEvidenceRecord[]> {
    const { scope } = await this.access.authorize(query, 'READ');
    const found = await this.returns.findById(query.returnId, scope);
    if (!found) {
      throw new ReturnNotFoundError(query.returnId);
    }
    return this.returns.listEvidences(query.returnId, scope);
  }
}
