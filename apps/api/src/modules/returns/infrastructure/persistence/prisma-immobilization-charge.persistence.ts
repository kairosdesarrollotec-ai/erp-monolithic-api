import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AddImmobilizationChargeInput,
  ImmobilizationChargeRecord,
} from '../../application/ports/return-repository.port';
import { toImmobilizationChargeRecord } from './return-persistence.mapper';

/** Persistencia de la subentidad ImmobilizationCharge (BR-DEV-011). */
@Injectable()
export class PrismaImmobilizationChargePersistence {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    input: AddImmobilizationChargeInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ImmobilizationChargeRecord> {
    const client = tx ?? this.prisma;
    const row = await client.immobilizationCharge.create({
      data: {
        returnId: input.returnId,
        damageId: input.damageId,
        daysCharged: input.daysCharged,
        dailyRate: input.dailyRate,
        totalAmount: input.totalAmount,
        notes: input.notes,
      },
    });
    return toImmobilizationChargeRecord(row);
  }
}
