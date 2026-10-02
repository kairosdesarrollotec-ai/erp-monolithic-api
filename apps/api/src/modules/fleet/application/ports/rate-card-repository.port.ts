export interface RateCard {
  id: string;
  organizationId: string;
  operatingCompanyId: string;
  amountPerDay: string;
  currency: string;
  validityHours: number;
  effectiveFrom: Date;
  createdAt: Date;
  createdBy: string;
}

export abstract class RateCardRepositoryPort {
  abstract create(params: {
    organizationId: string;
    operatingCompanyId: string;
    amountPerDay: number;
    currency: string;
    validityHours: number;
    effectiveFrom: Date;
    createdBy: string;
  }): Promise<RateCard>;

  abstract list(params: {
    organizationId: string;
    operatingCompanyId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: RateCard[]; total: number }>;

  abstract currentFor(
    organizationId: string,
    operatingCompanyId: string,
    at: Date,
  ): Promise<RateCard | null>;
}
