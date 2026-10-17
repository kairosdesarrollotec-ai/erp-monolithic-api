import type { Prisma } from '@prisma/client';
import { PrismaReturnVehicleCommitmentPersistence } from './prisma-return-vehicle-commitment.persistence';

describe('PrismaReturnVehicleCommitmentPersistence (DEC-DEV-COMMITMENT-001)', () => {
  it('libera (RELEASED) solo el compromiso RENTAL ACTIVE|CONSOLIDATED del alquiler y organización, dentro de la tx', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = { vehicleCommitment: { updateMany } } as unknown as Prisma.TransactionClient;

    const released = await new PrismaReturnVehicleCommitmentPersistence().releaseRentalCommitment('rent-1', 'org-1', tx);

    expect(released).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', sourceType: 'RENTAL', sourceId: 'rent-1', status: { in: ['ACTIVE', 'CONSOLIDATED'] } },
      data: { status: 'RELEASED' },
    });
  });
});
