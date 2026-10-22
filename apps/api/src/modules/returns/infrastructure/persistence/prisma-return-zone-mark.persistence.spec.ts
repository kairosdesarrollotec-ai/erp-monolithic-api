import { PrismaReturnZoneMarkPersistence } from './prisma-return-zone-mark.persistence';

describe('PrismaReturnZoneMarkPersistence (DEV-05 / PD-07)', () => {
  const markedAt = new Date('2026-10-22T10:00:00Z');
  function build() {
    const delegate = { findMany: jest.fn(), upsert: jest.fn().mockResolvedValue({}) };
    const prisma = { returnZoneMark: delegate };
    return { delegate, persistence: new PrismaReturnZoneMarkPersistence(prisma as never) };
  }

  it('list: filtra por devolución, ordena por zona y mapea', async () => {
    const { delegate, persistence } = build();
    delegate.findMany.mockResolvedValue([{ zone: 'FRONTAL', mark: 'DAMAGE', markedBy: 'u', markedAt }]);
    expect(await persistence.list('ret-1')).toEqual([{ zone: 'FRONTAL', mark: 'DAMAGE', markedBy: 'u', markedAt }]);
    expect(delegate.findMany).toHaveBeenCalledWith({ where: { returnId: 'ret-1' }, orderBy: { zone: 'asc' } });
  });

  it('upsertMany: un upsert por zona sobre la clave (returnId, zone); usa el cliente de la transacción si se pasa', async () => {
    const { delegate, persistence } = build();
    const txDelegate = { findMany: jest.fn(), upsert: jest.fn().mockResolvedValue({}) };
    await persistence.upsertMany(
      { returnId: 'ret-1', marks: [{ zone: 'FRONTAL', mark: 'DAMAGE' }, { zone: 'INTERIOR', mark: 'NO_DAMAGE' }], markedBy: 'u', markedAt },
      { returnZoneMark: txDelegate } as never,
    );
    expect(delegate.upsert).not.toHaveBeenCalled();
    expect(txDelegate.upsert).toHaveBeenCalledTimes(2);
    expect(txDelegate.upsert).toHaveBeenNthCalledWith(1, {
      where: { returnId_zone: { returnId: 'ret-1', zone: 'FRONTAL' } },
      create: { returnId: 'ret-1', zone: 'FRONTAL', mark: 'DAMAGE', markedBy: 'u', markedAt },
      update: { mark: 'DAMAGE', markedBy: 'u', markedAt },
    });
  });
});
