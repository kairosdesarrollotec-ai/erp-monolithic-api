import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MAX_SERIALIZATION_RETRIES, PrismaTransactionManager } from './prisma-transaction-manager';

function serializationFailure() {
  return new Prisma.PrismaClientKnownRequestError('could not serialize access', {
    code: 'P2034',
    clientVersion: 'test',
  });
}

describe('PrismaTransactionManager', () => {
  it('reintenta una transaccion abortada por serializacion (P2034) y devuelve el resultado del reintento', async () => {
    const $transaction = jest
      .fn()
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<string>) => fn({}));
    const manager = new PrismaTransactionManager({ $transaction } as any);

    await expect(manager.run(async () => 'ok', { isolationLevel: 'Serializable' })).resolves.toBe('ok');
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it(`tras ${MAX_SERIALIZATION_RETRIES} reintentos responde 409 TRANSACTION_CONFLICT (recuperable), nunca 500`, async () => {
    const $transaction = jest.fn().mockRejectedValue(serializationFailure());
    const manager = new PrismaTransactionManager({ $transaction } as any);

    const error = await manager.run(async () => 'x').catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'TRANSACTION_CONFLICT' }));
    expect($transaction).toHaveBeenCalledTimes(MAX_SERIALIZATION_RETRIES + 1);
  });

  it('no reintenta errores de negocio: los propaga tal cual', async () => {
    const business = new Error('negocio');
    const $transaction = jest.fn().mockRejectedValue(business);
    const manager = new PrismaTransactionManager({ $transaction } as any);

    await expect(manager.run(async () => 'x')).rejects.toBe(business);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
