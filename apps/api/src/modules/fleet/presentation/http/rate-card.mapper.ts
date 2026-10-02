import { RateCard } from '../../application/ports/rate-card-repository.port';
import { RateCardResponse } from './dto/rate-card.response';

export function toRateCardResponse(rateCard: RateCard): RateCardResponse {
  return {
    id: rateCard.id,
    operatingCompanyId: rateCard.operatingCompanyId,
    amountPerDay: rateCard.amountPerDay,
    currency: rateCard.currency,
    validityHours: rateCard.validityHours,
    effectiveFrom: rateCard.effectiveFrom.toISOString(),
    createdAt: rateCard.createdAt.toISOString(),
    createdBy: rateCard.createdBy,
  };
}
