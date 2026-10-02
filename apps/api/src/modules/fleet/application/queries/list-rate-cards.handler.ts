import { Injectable } from '@nestjs/common';
import { ListRateCardsQuery } from './list-rate-cards.query';
import { RateCard, RateCardRepositoryPort } from '../ports/rate-card-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetRead } from '../policies/fleet-role.policy';

@Injectable()
export class ListRateCardsHandler {
  constructor(
    private readonly rateCards: RateCardRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: ListRateCardsQuery): Promise<{ items: RateCard[]; total: number }> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    assertFleetRead(context.role);

    return this.rateCards.list({
      organizationId: context.organizationId,
      operatingCompanyId: context.companyId,
      limit: Math.min(Math.max(query.limit, 1), 100),
      offset: Math.max(query.offset, 0),
    });
  }
}
