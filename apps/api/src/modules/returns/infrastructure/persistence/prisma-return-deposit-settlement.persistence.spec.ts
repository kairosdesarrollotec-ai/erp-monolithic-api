import { Prisma } from '@prisma/client';
import { PrismaReturnDepositSettlementPersistence } from './prisma-return-deposit-settlement.persistence';
import { ReturnDepositAlreadySettledError } from '../../domain/return-errors';

describe('PrismaReturnDepositSettlementPersistence', () => {
  function buildTx(depositStatus: string | null) {
    const tx = {
      rentalDeposit: {
        findUnique: jest.fn().mockResolvedValue(depositStatus ? { id: 'dep-1', rentalId: 'rent-1', status: depositStatus } : null),
        update: jest.fn().mockResolvedValue(undefined),
      },
      rentalDepositAdjustment: {
        create: jest.fn().mockResolvedValue(undefined),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    return { tx, client: tx as unknown as Prisma.TransactionClient };
  }

  const persistence = new PrismaReturnDepositSettlementPersistence();

  it('recordImmobilizationCharge: agrega ajuste IMMOBILIZATION_CHARGE a la garantía', async () => {
    const { tx, client } = buildTx('HELD');
    const result = await persistence.recordImmobilizationCharge(
      { rentalId: 'rent-1', amount: 200, reason: 'Cargo por paralización', authorizedBy: 'uid-1' },
      client,
    );
    expect(result).toEqual({ applied: true });
    expect(tx.rentalDepositAdjustment.create).toHaveBeenCalledWith({
      data: { depositId: 'dep-1', type: 'IMMOBILIZATION_CHARGE', amount: 200, reason: 'Cargo por paralización', authorizedBy: 'uid-1' },
    });
  });

  it('sin garantía registrada es no-op', async () => {
    const { tx, client } = buildTx(null);
    expect(
      await persistence.recordImmobilizationCharge({ rentalId: 'rent-1', amount: 1, reason: 'x', authorizedBy: 'u' }, client),
    ).toEqual({ applied: false });
    expect(
      await persistence.settleDeposit({ rentalId: 'rent-1', status: 'RETURNED', adjustments: [], authorizedBy: 'u' }, client),
    ).toEqual({ applied: false });
    expect(tx.rentalDepositAdjustment.create).not.toHaveBeenCalled();
  });

  it('settleDeposit: inserta ajustes y actualiza el estado de la garantía desde HELD', async () => {
    const { tx, client } = buildTx('HELD');
    const result = await persistence.settleDeposit(
      {
        rentalId: 'rent-1',
        status: 'PARTIALLY_RETAINED',
        adjustments: [
          { type: 'RELEASE', amount: 320, reason: 'Liberación' },
          { type: 'DISCOUNT', amount: 180, reason: 'Descuento' },
        ],
        authorizedBy: 'uid-1',
      },
      client,
    );
    expect(result).toEqual({ applied: true });
    expect(tx.rentalDepositAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        { depositId: 'dep-1', type: 'RELEASE', amount: 320, reason: 'Liberación', authorizedBy: 'uid-1' },
        { depositId: 'dep-1', type: 'DISCOUNT', amount: 180, reason: 'Descuento', authorizedBy: 'uid-1' },
      ],
    });
    expect(tx.rentalDeposit.update).toHaveBeenCalledWith({ where: { id: 'dep-1' }, data: { status: 'PARTIALLY_RETAINED' } });
  });

  it('settleDeposit: garantía ya liquidada -> ReturnDepositAlreadySettledError sin escribir', async () => {
    const { tx, client } = buildTx('RETURNED');
    await expect(
      persistence.settleDeposit({ rentalId: 'rent-1', status: 'RETURNED', adjustments: [], authorizedBy: 'u' }, client),
    ).rejects.toThrow(ReturnDepositAlreadySettledError);
    expect(tx.rentalDeposit.update).not.toHaveBeenCalled();
  });
});
