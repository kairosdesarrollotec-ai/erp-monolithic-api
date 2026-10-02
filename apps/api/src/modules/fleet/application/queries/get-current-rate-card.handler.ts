import { Injectable, NotFoundException } from '@nestjs/common';
import { GetCurrentRateCardQuery } from './get-current-rate-card.query';
import { RateCard, RateCardRepositoryPort } from '../ports/rate-card-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { assertFleetRead } from '../policies/fleet-role.policy';

@Injectable()
export class GetCurrentRateCardHandler {
  constructor(
    private readonly rateCards: RateCardRepositoryPort,
    private readonly workContext: WorkContextAuthorizationService,
  ) {}

  async execute(query: GetCurrentRateCardQuery): Promise<RateCard> {
    const context = await this.workContext.authorize({
      firebaseUid: query.firebaseUid,
      companyId: query.companyId,
      branchId: query.branchId,
    });

    assertFleetRead(context.role);

    const rateCard = await this.rateCards.currentFor(
      context.organizationId,
      context.companyId,
      new Date(),
    );

    if (!rateCard) {
      throw new NotFoundException({
        code: 'RATE_CARD_NOT_CONFIGURED',
        detail: `No hay tarifa configurada para esta empresa a la fecha actual.`,
      });
    }

    return rateCard;
  }
}
