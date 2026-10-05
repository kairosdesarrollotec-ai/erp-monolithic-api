import { Injectable } from '@nestjs/common';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { GetReturnQuery } from './get-return.query';

@Injectable()
export class GetReturnHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
  ) {}

  async execute(query: GetReturnQuery): Promise<ReturnRecord> {
    const { scope } = await this.access.authorize(query, 'READ');
    const found = await this.returns.findById(query.id, scope);
    if (!found) {
      throw new ReturnNotFoundError(query.id);
    }
    return found;
  }
}
