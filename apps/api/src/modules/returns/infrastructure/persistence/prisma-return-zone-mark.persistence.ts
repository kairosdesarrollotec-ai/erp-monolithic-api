import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ReturnZoneMarkRepositoryPort } from '../../application/ports/return-zone-mark-repository.port';
import type { ReturnZoneMarkRecord, ReturnZoneMarkValue, ReturnZoneMarkZone } from '../../domain/return-zone-marks';

interface ZoneMarkRow {
  zone: string;
  mark: string;
  markedBy: string;
  markedAt: Date;
}

/** Delegado minimo del modelo `ReturnZoneMark` (migracion 20261022040001): compila aun antes de regenerar el cliente Prisma. */
interface ZoneMarkDelegate {
  findMany(args: { where: { returnId: string }; orderBy: { zone: 'asc' } }): Promise<ZoneMarkRow[]>;
  upsert(args: {
    where: { returnId_zone: { returnId: string; zone: string } };
    create: { returnId: string; zone: string; mark: string; markedBy: string; markedAt: Date };
    update: { mark: string; markedBy: string; markedAt: Date };
  }): Promise<unknown>;
}

@Injectable()
export class PrismaReturnZoneMarkPersistence implements ReturnZoneMarkRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private zoneMarks(tx?: Prisma.TransactionClient): ZoneMarkDelegate {
    const client: unknown = tx ?? this.prisma;
    return (client as { returnZoneMark: ZoneMarkDelegate }).returnZoneMark;
  }

  async list(returnId: string, tx?: Prisma.TransactionClient): Promise<ReturnZoneMarkRecord[]> {
    const rows = await this.zoneMarks(tx).findMany({ where: { returnId }, orderBy: { zone: 'asc' } });
    return rows.map((row) => ({
      zone: row.zone as ReturnZoneMarkZone,
      mark: row.mark as ReturnZoneMarkValue,
      markedBy: row.markedBy,
      markedAt: row.markedAt,
    }));
  }

  async upsertMany(
    input: { returnId: string; marks: ReadonlyArray<{ zone: string; mark: ReturnZoneMarkValue }>; markedBy: string; markedAt: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const delegate = this.zoneMarks(tx);
    for (const { zone, mark } of input.marks) {
      await delegate.upsert({
        where: { returnId_zone: { returnId: input.returnId, zone } },
        create: { returnId: input.returnId, zone, mark, markedBy: input.markedBy, markedAt: input.markedAt },
        update: { mark, markedBy: input.markedBy, markedAt: input.markedAt },
      });
    }
  }
}
