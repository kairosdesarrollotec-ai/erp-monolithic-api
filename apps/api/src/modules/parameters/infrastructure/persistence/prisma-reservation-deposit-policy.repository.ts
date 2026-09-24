import { Injectable } from '@nestjs/common';
import type { Prisma, ReservationDepositPolicyVersion } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { CURRENT_RESERVATION_DEPOSIT_POLICY } from '../../../reservations/domain/reservation-deposit-policy';
import {
  CreateReservationDepositPolicyVersionInput,
  ReservationDepositPolicyPort,
  ReservationDepositPolicySnapshot,
} from '../../application/ports/reservation-deposit-policy.port';

@Injectable()
export class PrismaReservationDepositPolicyRepository implements ReservationDepositPolicyPort {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string): Promise<ReservationDepositPolicySnapshot> {
    const latest = await this.prisma.reservationDepositPolicyVersion.findFirst({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      return {
        version: CURRENT_RESERVATION_DEPOSIT_POLICY.version,
        amount: CURRENT_RESERVATION_DEPOSIT_POLICY.amount,
        currency: CURRENT_RESERVATION_DEPOSIT_POLICY.currency,
        effectiveFrom: null,
      };
    }
    return this.toSnapshot(latest);
  }

  async listHistory(organizationId: string): Promise<ReservationDepositPolicySnapshot[]> {
    const rows = await this.prisma.reservationDepositPolicyVersion.findMany({
      where: { organizationId },
      orderBy: { version: 'desc' },
    });
    return rows.map((row) => this.toSnapshot(row));
  }

  async createVersion(
    input: CreateReservationDepositPolicyVersionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReservationDepositPolicySnapshot> {
    const client = tx ?? this.prisma;
    const latest = await client.reservationDepositPolicyVersion.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const created = await client.reservationDepositPolicyVersion.create({
      data: {
        organizationId: input.organizationId,
        version: nextVersion,
        amount: input.amount,
        currency: input.currency,
        createdBy: input.createdBy,
      },
    });
    return this.toSnapshot(created);
  }

  private toSnapshot(row: ReservationDepositPolicyVersion): ReservationDepositPolicySnapshot {
    return {
      version: row.version,
      amount: row.amount.toString(),
      currency: row.currency,
      effectiveFrom: row.effectiveFrom,
    };
  }
}
