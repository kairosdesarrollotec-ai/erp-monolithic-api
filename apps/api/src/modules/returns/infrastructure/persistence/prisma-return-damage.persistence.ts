import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { AddDamageInput, ReturnDamageRecord } from '../../application/ports/return-repository.port';
import { toReturnDamageRecord } from './return-persistence.mapper';

/** Persistencia de la subentidad ReturnDamage (DEV-06/07) - mismo criterio modular que rentals. */
@Injectable()
export class PrismaReturnDamagePersistence {
  constructor(private readonly prisma: PrismaService) {}

  async add(input: AddDamageInput, tx?: Prisma.TransactionClient): Promise<ReturnDamageRecord> {
    const client = tx ?? this.prisma;
    const row = await client.returnDamage.create({
      data: {
        returnId: input.returnId,
        origin: input.origin,
        severity: input.severity,
        damagedZone: input.damagedZone,
        estimatedAmount: input.estimatedAmount,
        externalReportReference: input.externalReportReference,
        description: input.description,
      },
    });
    return toReturnDamageRecord(row);
  }
}
