import { Injectable, Optional } from '@nestjs/common';
import { ClockPort, SystemClock } from '../../../../common/application/ports/clock.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { computeReturnAlerts } from '../../domain/return-alerts';
import { ListReturnsQuery } from './list-returns.query';

@Injectable()
export class ListReturnsHandler {
  private readonly clock: ClockPort;

  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    @Optional() clock?: ClockPort,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  async execute(query: ListReturnsQuery): Promise<ReturnRecord[]> {
    const { scope } = await this.access.authorize(query, 'READ');
    const rows = await this.returns.list({
      ...scope,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    const now = this.clock.now();
    return rows.map((row) => ({ ...row, alerts: computeReturnAlerts(row, now) }));
  }
}
