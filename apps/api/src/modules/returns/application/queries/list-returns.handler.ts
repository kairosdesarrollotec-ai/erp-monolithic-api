import { Injectable } from '@nestjs/common';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ListReturnsQuery } from './list-returns.query';

@Injectable()
export class ListReturnsHandler {
  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
  ) {}

  async execute(query: ListReturnsQuery): Promise<ReturnRecord[]> {
    const { scope } = await this.access.authorize(query, 'READ');
    return this.returns.list({
      ...scope,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
