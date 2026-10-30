import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ReturnFuelLineReadings, ReturnFuelReadingsPort } from '../../application/ports/return-fuel-readings.port';
import type { ReturnScope } from '../../application/ports/return-repository.port';

@Injectable()
export class PrismaReturnFuelReadingsPersistence extends ReturnFuelReadingsPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findLines(
    input: { vehicleId: string; rentalId: string; returnId: string; scope: ReturnScope },
    tx?: Prisma.TransactionClient,
  ): Promise<ReturnFuelLineReadings> {
    const client = tx ?? this.prisma;
    const latest = async (processType: 'RENTAL' | 'RETURN', processId: string): Promise<number | null> => {
      const row = await client.vehicleOperationalRecord.findFirst({
        where: {
          vehicleId: input.vehicleId,
          operatingCompanyId: input.scope.operatingCompanyId,
          formatType: 'FORMATO_06_RNC',
          processType,
          processId,
          fuelLevelLines: { not: null },
        },
        orderBy: { performedAt: 'desc' },
        select: { fuelLevelLines: true },
      });
      return row?.fuelLevelLines ?? null;
    };
    const [deliveryLines, returnLines] = await Promise.all([
      latest('RENTAL', input.rentalId),
      latest('RETURN', input.returnId),
    ]);
    return { deliveryLines, returnLines };
  }
}
