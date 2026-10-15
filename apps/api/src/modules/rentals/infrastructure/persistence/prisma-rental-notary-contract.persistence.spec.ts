import { Prisma } from '@prisma/client';
import { PrismaRentalNotaryContractPersistence } from './prisma-rental-notary-contract.persistence';
import type { FormalizeContractInput } from '../../application/ports/rental-repository.port';

describe('PrismaRentalNotaryContractPersistence.formalizeContractAndDeposit (DEC-ALQ-COMPANY-DRIVER-004)', () => {
  const input = (over: Partial<FormalizeContractInput> = {}): FormalizeContractInput => ({
    rentalId: 'r1',
    scope: { organizationId: 'o', operatingCompanyId: 'c', branchId: 'b' },
    expectedVersion: 1,
    documentRef: 'doc',
    depositRequired: true,
    depositAmount: '500.00',
    currency: 'PEN',
    reservationCreditAmount: '300.00',
    reservationCreditExcess: '0.00',
    updatedBy: 'u',
    ...over,
  });
  const tx = () => ({
    rentalContract: { upsert: jest.fn().mockResolvedValue({}) },
    rentalDeposit: { upsert: jest.fn().mockResolvedValue({}) },
  });
  const run = (client: ReturnType<typeof tx>, i: FormalizeContractInput) =>
    new PrismaRentalNotaryContractPersistence({} as never).formalizeContractAndDeposit(i, client as unknown as Prisma.TransactionClient);

  it('con garantia: crea contrato (depositRequired=true) y la fila de deposit', async () => {
    const client = tx();
    await run(client, input());
    expect(client.rentalContract.upsert.mock.calls[0][0].create).toMatchObject({ depositRequired: true });
    expect(client.rentalDeposit.upsert).toHaveBeenCalledTimes(1);
  });

  it('sin garantia: NO crea fila de deposit y el credito de reserva queda como saldo a favor en el contrato', async () => {
    const client = tx();
    await run(client, input({ depositRequired: false, depositAmount: '0.00', reservationCreditAmount: '0.00', reservationCreditExcess: '300.00' }));
    expect(client.rentalDeposit.upsert).not.toHaveBeenCalled();
    const create = client.rentalContract.upsert.mock.calls[0][0].create;
    expect(create.depositRequired).toBe(false);
    expect(create.reservationCreditExcess.toString()).toBe('300');
  });
});
