import { Injectable, Optional } from '@nestjs/common';
import { ClockPort, SystemClock } from '../../../../common/application/ports/clock.port';
import { ReturnRecord, ReturnRepositoryPort } from '../ports/return-repository.port';
import { ReturnAccessService } from '../services/return-access.service';
import { ReturnNotFoundError } from '../../domain/return-errors';
import { computeReturnAlerts } from '../../domain/return-alerts';
import { computeReturnLateness } from '../../domain/return-lateness';
import { chargeFor } from './return-late-charge';
import { GetReturnQuery } from './get-return.query';

@Injectable()
export class GetReturnHandler {
  private readonly clock: ClockPort;

  constructor(
    private readonly access: ReturnAccessService,
    private readonly returns: ReturnRepositoryPort,
    @Optional() clock?: ClockPort,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  async execute(query: GetReturnQuery): Promise<ReturnRecord> {
    const { scope } = await this.access.authorize(query, 'READ');
    const found = await this.returns.findById(query.id, scope);
    if (!found) {
      throw new ReturnNotFoundError(query.id);
    }
    // Alertas operativas (garantía 24 h / inmovilización > 24 h) calculadas con el reloj.
    const now = this.clock.now();
    return { ...found, alerts: computeReturnAlerts(found, now),
      lateness: computeReturnLateness(found, now),
      latenessCharge: chargeFor(found, now),
    };
  }
}
