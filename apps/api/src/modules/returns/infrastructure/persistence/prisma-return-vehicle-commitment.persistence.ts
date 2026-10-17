import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ReturnVehicleCommitmentPort } from '../../application/ports/return-vehicle-commitment.port';
import { BLOCKING_COMMITMENT_STATUSES } from '../../../../common/persistence/vehicle-overlap';

@Injectable()
export class PrismaReturnVehicleCommitmentPersistence implements ReturnVehicleCommitmentPort {
  async releaseRentalCommitment(rentalId: string, organizationId: string, tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.vehicleCommitment.updateMany({
      where: {
        organizationId,
        sourceType: 'RENTAL',
        sourceId: rentalId,
        status: { in: [...BLOCKING_COMMITMENT_STATUSES] },
      },
      data: { status: 'RELEASED' },
    });
    return result.count;
  }
}
