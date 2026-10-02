export interface RateCardResponse {
  id: string;
  operatingCompanyId: string;
  amountPerDay: string;
  currency: string;
  validityHours: number;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string;
}

export interface ListRateCardsResponse {
  items: RateCardResponse[];
  total: number;
}
