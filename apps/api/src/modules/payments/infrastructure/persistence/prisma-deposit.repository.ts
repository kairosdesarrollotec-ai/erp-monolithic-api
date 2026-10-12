import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AdjustmentRecord,
  DepositAggregate,
  DepositRepositoryPort,
  DepositScope,
  DepositSummary,
  ListDepositsFilters,
  NewAdjustment,
} from '../../application/ports/deposit-repository.port';
import type { DepositStatus } from '../../domain/deposit-status';
import type { AdjustmentType } from '../../domain/adjustment-type';

type RawDeposit = {
  id: string;
  rentalId: string;
  originalAmount: { toNumber: () => number };
  currency: string;
  status: string;
  closedAt: Date | null;
  closureNotes: string | null;
  createdAt: Date;
  rental: {
    id?: string;
    customer?: { fullName?: string | null } | null;
    vehicle?: { plate?: string | null } | null;
  } | null;
  adjustments: Array<{
    id: string;
    depositId: string;
    type: string;
    amount: { toNumber: () => number };
    reason: string;
    authorizedBy: string;
    createdAt: Date;
  }>;
};

function toAdjustmentRecord(raw: RawDeposit['adjustments'][0]): AdjustmentRecord {
  return {
    id: raw.id,
    depositId: raw.depositId,
    type: raw.type as AdjustmentType,
    amount: raw.amount.toNumber(),
    reason: raw.reason,
    authorizedBy: raw.authorizedBy,
    createdAt: raw.createdAt,
  };
}

function resolveClientName(rental: RawDeposit['rental'] | null): string {
  return rental?.customer?.fullName ?? '';
}

function toDepositAggregate(raw: RawDeposit): DepositAggregate {
  const adjustments = raw.adjustments.map(toAdjustmentRecord);
  const updatedAt = adjustments.length > 0 ? adjustments[adjustments.length - 1].createdAt : raw.createdAt;
  return {
    id: raw.id,
    rentalId: raw.rentalId,
    rentalCode: raw.rentalId,
    clientName: resolveClientName(raw.rental),
    vehiclePlate: raw.rental?.vehicle?.plate ?? null,
    originalAmount: raw.originalAmount.toNumber(),
    currency: raw.currency,
    status: raw.status as DepositStatus,
    closedAt: raw.closedAt,
    closureNotes: raw.closureNotes,
    createdAt: raw.createdAt,
    updatedAt,
    adjustments,
  };
}

const DEPOSIT_DETAIL_INCLUDE = {
  adjustments: { orderBy: { createdAt: 'asc' as const } },
  rental: {
    include: {
      customer: { select: { fullName: true } },
      vehicle: { select: { plate: true } },
    },
  },
} as const;

/**
 * Repositorio Prisma de garantias de alquiler.
 * INV-PAG-005: todas las consultas incluyen JOIN via rental.operatingCompanyId = scope.companyId para aislamiento.
 */
@Injectable()
export class PrismaDepositRepository implements DepositRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, scope: DepositScope): Promise<DepositAggregate | null> {
    const raw = await this.prisma.rentalDeposit.findFirst({
      where: { id, rental: { operatingCompanyId: scope.companyId, branchId: scope.branchId } },
      include: DEPOSIT_DETAIL_INCLUDE,
    });
    return raw ? toDepositAggregate(raw as unknown as RawDeposit) : null;
  }

  async findByRentalId(rentalId: string, scope: DepositScope): Promise<DepositAggregate | null> {
    const raw = await this.prisma.rentalDeposit.findFirst({
      where: { rentalId, rental: { operatingCompanyId: scope.companyId, branchId: scope.branchId } },
      include: DEPOSIT_DETAIL_INCLUDE,
    });
    return raw ? toDepositAggregate(raw as unknown as RawDeposit) : null;
  }

  async listByScope(scope: DepositScope, filters: ListDepositsFilters): Promise<{ data: DepositSummary[]; total: number }> {
    const where = {
      rental: {
        operatingCompanyId: scope.companyId,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.rentalId ? { rentalId: filters.rentalId } : {}),
      ...(filters.cursor
        ? {
            OR: [
              { createdAt: { lt: filters.cursor.createdAt } },
              { createdAt: filters.cursor.createdAt, id: { lt: filters.cursor.id } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.rentalDeposit.findMany({
        where,
        take: filters.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          adjustments: { select: { amount: true } },
          rental: {
            include: {
              customer: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.rentalDeposit.count({ where }),
    ]);

    const data: DepositSummary[] = rows.map((row) => {
      const adjustedAmount = row.adjustments.reduce((s: number, a: { amount: { toNumber: () => number } }) => s + a.amount.toNumber(), 0);
      const originalAmount = (row.originalAmount as unknown as { toNumber: () => number }).toNumber();
      return {
        id: row.id,
        rentalId: row.rentalId,
        rentalCode: row.rentalId,
        clientName: (row.rental as unknown as { customer?: { fullName?: string | null } | null })?.customer?.fullName ?? '',
        originalAmount,
        currency: row.currency,
        adjustedAmount: adjustedAmount > 0 ? adjustedAmount : null,
        netAmount: adjustedAmount > 0 ? originalAmount - adjustedAmount : null,
        currentStatus: row.status as DepositStatus,
        createdAt: row.createdAt,
      };
    });

    return { data, total };
  }

  async updateStatus(id: string, status: DepositStatus, closedAt?: Date, closureNotes?: string): Promise<void> {
    await this.prisma.rentalDeposit.update({
      where: { id },
      data: {
        status,
        ...(closedAt !== undefined ? { closedAt } : {}),
        ...(closureNotes !== undefined ? { closureNotes } : {}),
      },
    });
  }

  async addAdjustment(depositId: string, adjustment: NewAdjustment): Promise<AdjustmentRecord> {
    const created = await this.prisma.rentalDepositAdjustment.create({
      data: {
        depositId,
        type: adjustment.type,
        amount: adjustment.amount,
        reason: adjustment.reason,
        authorizedBy: adjustment.authorizedBy,
      },
    });
    return {
      id: created.id,
      depositId: created.depositId,
      type: created.type as AdjustmentType,
      amount: (created.amount as unknown as { toNumber: () => number }).toNumber(),
      reason: created.reason,
      authorizedBy: created.authorizedBy,
      createdAt: created.createdAt,
    };
  }
}
