import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { RateCard, RateCardRepositoryPort } from '../../application/ports/rate-card-repository.port';

@Injectable()
export class PrismaRateCardRepository extends RateCardRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(params: {
    organizationId: string;
    operatingCompanyId: string;
    amountPerDay: number;
    currency: string;
    validityHours: number;
    effectiveFrom: Date;
    createdBy: string;
  }): Promise<RateCard> {
    const entry = await this.prisma.rateCardEntry.create({
      data: {
        organizationId: params.organizationId,
        operatingCompanyId: params.operatingCompanyId,
        amountPerDay: params.amountPerDay,
        currency: params.currency,
        validityHours: params.validityHours,
        effectiveFrom: params.effectiveFrom,
        createdBy: params.createdBy,
      },
    });

    return this.toRateCard(entry);
  }

  async list(params: {
    organizationId: string;
    operatingCompanyId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: RateCard[]; total: number }> {
    const where = {
      organizationId: params.organizationId,
      operatingCompanyId: params.operatingCompanyId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rateCardEntry.findMany({
        where,
        orderBy: { effectiveFrom: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.rateCardEntry.count({ where }),
    ]);

    return { items: items.map((e) => this.toRateCard(e)), total };
  }

  async currentFor(
    organizationId: string,
    operatingCompanyId: string,
    at: Date,
  ): Promise<RateCard | null> {
    const entry = await this.prisma.rateCardEntry.findFirst({
      where: {
        organizationId,
        operatingCompanyId,
        effectiveFrom: { lte: at },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return entry ? this.toRateCard(entry) : null;
  }

  private toRateCard(entry: {
    id: string;
    organizationId: string;
    operatingCompanyId: string;
    amountPerDay: { toString(): string };
    currency: string;
    validityHours: number;
    effectiveFrom: Date;
    createdAt: Date;
    createdBy: string;
  }): RateCard {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      operatingCompanyId: entry.operatingCompanyId,
      amountPerDay: entry.amountPerDay.toString(),
      currency: entry.currency,
      validityHours: entry.validityHours,
      effectiveFrom: entry.effectiveFrom,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
    };
  }
}
