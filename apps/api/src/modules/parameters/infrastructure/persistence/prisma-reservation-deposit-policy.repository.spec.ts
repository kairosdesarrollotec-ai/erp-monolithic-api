import { PrismaService } from '../../../../common/persistence/prisma.service';
import { PrismaReservationDepositPolicyRepository } from './prisma-reservation-deposit-policy.repository';
import { CURRENT_RESERVATION_DEPOSIT_POLICY } from '../../../reservations/domain/reservation-deposit-policy';

const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'pol-1',
  organizationId: 'org-1',
  version: 1,
  amount: '300.00',
  currency: 'PEN',
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'admin-uid',
  ...overrides,
});

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    reservationDepositPolicyVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      ...overrides,
    },
  } as unknown as jest.Mocked<PrismaService>;
}

describe('PrismaReservationDepositPolicyRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('getCurrent', () => {
    it('devuelve la version con mayor numero cuando existe al menos una fila', async () => {
      const row = makeRow({ version: 3, amount: '500.00' });
      const prisma = buildPrisma({ findFirst: jest.fn().mockResolvedValue(row) });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.getCurrent('org-1');

      expect(result.version).toBe(3);
      expect(result.amount).toBe('500.00');
      expect(result.currency).toBe('PEN');
      expect(result.effectiveFrom).toEqual(row.effectiveFrom);
    });

    it('devuelve el valor por defecto historico cuando la organizacion no tiene filas', async () => {
      const prisma = buildPrisma({ findFirst: jest.fn().mockResolvedValue(null) });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.getCurrent('org-nueva');

      expect(result.version).toBe(CURRENT_RESERVATION_DEPOSIT_POLICY.version);
      expect(result.amount).toBe(CURRENT_RESERVATION_DEPOSIT_POLICY.amount);
      expect(result.currency).toBe(CURRENT_RESERVATION_DEPOSIT_POLICY.currency);
      expect(result.effectiveFrom).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('devuelve el historial completo ordenado por version descendente', async () => {
      const rows = [makeRow({ version: 2, amount: '400.00' }), makeRow({ version: 1, amount: '300.00' })];
      const prisma = buildPrisma({ findMany: jest.fn().mockResolvedValue(rows) });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.listHistory('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
    });

    it('devuelve arreglo vacio si no hay historial', async () => {
      const prisma = buildPrisma({ findMany: jest.fn().mockResolvedValue([]) });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.listHistory('org-sin-historial');

      expect(result).toEqual([]);
    });
  });

  describe('createVersion', () => {
    it('incrementa la version respecto a la ultima existente', async () => {
      const latest = makeRow({ version: 2 });
      const created = makeRow({ version: 3, amount: '600.00' });
      const findFirst = jest.fn().mockResolvedValue(latest);
      const create = jest.fn().mockResolvedValue(created);
      const prisma = buildPrisma({ findFirst, create });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.createVersion({ organizationId: 'org-1', amount: '600.00', currency: 'PEN', createdBy: 'admin' });

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }));
      expect(result.version).toBe(3);
      expect(result.amount).toBe('600.00');
    });

    it('CR-05: sin politica previa persiste el valor inicial como version 1 y la nueva queda como version 2', async () => {
      const created = makeRow({ version: 2, amount: '350.00' });
      const findFirst = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockResolvedValueOnce(makeRow({ version: 1 })).mockResolvedValueOnce(created);
      const prisma = buildPrisma({ findFirst, create });
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      const result = await repo.createVersion({ organizationId: 'org-nueva', amount: '350.00', currency: 'PEN', createdBy: 'admin' });

      expect(create).toHaveBeenCalledTimes(2);
      expect(create.mock.calls[0][0].data).toMatchObject({ version: 1, amount: '300.00', createdBy: 'system-default' });
      expect(create.mock.calls[1][0].data).toMatchObject({ version: 2, amount: '350.00', createdBy: 'admin' });
      expect(result.version).toBe(2);
    });

    it('usa el TransactionClient cuando se pasa tx', async () => {
      const txFindFirst = jest.fn().mockResolvedValue(makeRow({ version: 1 }));
      const txCreate = jest.fn().mockResolvedValue(makeRow({ version: 2 }));
      const tx = { reservationDepositPolicyVersion: { findFirst: txFindFirst, create: txCreate } } as unknown as Parameters<typeof repo.createVersion>[1];
      const prisma = buildPrisma();
      const repo = new PrismaReservationDepositPolicyRepository(prisma);

      await repo.createVersion({ organizationId: 'org-1', amount: '400.00', currency: 'PEN', createdBy: 'admin' }, tx);

      expect(txCreate).toHaveBeenCalled();
      expect((prisma.reservationDepositPolicyVersion.create as jest.Mock).mock.calls).toHaveLength(0);
    });
  });
});
