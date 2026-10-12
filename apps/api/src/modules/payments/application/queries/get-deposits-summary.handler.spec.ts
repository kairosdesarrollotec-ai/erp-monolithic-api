import { GetDepositsSummaryHandler } from './get-deposits-summary.handler';
import { GetDepositsSummaryQuery } from './get-deposits-summary.query';

/**
 * PAG-01 — Pruebas del handler de resumen de garantias.
 * BR-PAG-007: requiere PAYMENT.READ_LIST (validado por PaymentAccessService).
 * INV-PAG-005: aislamiento multiempresa — groupBy filtra por rental.operatingCompanyId.
 */

function buildMockAccess(companyId = 'comp-1', branchId = 'branch-1') {
  return {
    authorize: jest.fn().mockResolvedValue({
      context: {
        organizationId: 'org-1',
        companyId,
        branchId,
        roleId: 'role-CASHIER',
      },
      scope: {
        organizationId: 'org-1',
        companyId,
        branchId,
      },
    }),
  };
}

function buildMockPrisma(groupByResult: unknown[] = []) {
  return {
    rentalDeposit: {
      groupBy: jest.fn().mockResolvedValue(groupByResult),
    },
  };
}

describe('GetDepositsSummaryHandler (PAG-01 / BR-PAG-007)', () => {
  describe('Calculo de conteos y montos', () => {
    it('devuelve conteos y montos correctos a partir del resultado de groupBy', async () => {
      const access = buildMockAccess();
      const prisma = buildMockPrisma([
        { status: 'HELD', _count: { id: 14 }, _sum: { originalAmount: 18200 } },
        { status: 'RETURNED', _count: { id: 42 }, _sum: { originalAmount: 35600 } },
      ]);

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      const result = await handler.execute(new GetDepositsSummaryQuery('uid-1', 'comp-1', 'branch-1'));

      expect(result.held).toBe(14);
      expect(result.returned).toBe(42);
      expect(result.retained).toBe(0);
      expect(result.partiallyRetained).toBe(0);
      expect(result.totalAmount).toBe(53800);
      expect(result.heldAmount).toBe(18200);
    });

    it('incluye conteos para RETAINED y PARTIALLY_RETAINED cuando existen en el groupBy', async () => {
      const access = buildMockAccess();
      const prisma = buildMockPrisma([
        { status: 'HELD', _count: { id: 5 }, _sum: { originalAmount: 5000 } },
        { status: 'RETAINED', _count: { id: 3 }, _sum: { originalAmount: 3000 } },
        { status: 'PARTIALLY_RETAINED', _count: { id: 2 }, _sum: { originalAmount: 1500 } },
      ]);

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      const result = await handler.execute(new GetDepositsSummaryQuery('uid-1', 'comp-1', 'branch-1'));

      expect(result.retained).toBe(3);
      expect(result.partiallyRetained).toBe(2);
      expect(result.totalAmount).toBe(9500);
    });
  });

  describe('P0 — Aislamiento multiempresa (INV-PAG-005)', () => {
    it('el groupBy incluye rental.operatingCompanyId y rental.branchId del scope autorizado', async () => {
      const companyId = 'comp-motrix';
      const branchId = 'branch-arequipa';
      const access = buildMockAccess(companyId, branchId);
      const prisma = buildMockPrisma([]);

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      await handler.execute(new GetDepositsSummaryQuery('uid-1', companyId, branchId));

      expect(prisma.rentalDeposit.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rental: expect.objectContaining({
              operatingCompanyId: companyId,
              branchId: branchId,
            }),
          }),
        }),
      );
    });

    it('no expone datos de otra empresa: el scope siempre proviene del contexto autorizado, no del query', async () => {
      // El access.authorize devuelve comp-1/branch-1 independientemente de lo que
      // el cliente pase en el query. Esto garantiza que el scope es el del token,
      // no el del payload.
      const access = buildMockAccess('comp-1', 'branch-1');
      const prisma = buildMockPrisma([]);

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      // El query puede venir con comp-other, pero el scope del groupBy usa comp-1
      await handler.execute(new GetDepositsSummaryQuery('uid-1', 'comp-other', 'branch-other'));

      // authorize fue llamado con los datos del query (como input de autorizacion)
      expect(access.authorize).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'comp-other' }),
        'READ_LIST',
      );

      // pero el groupBy usa el scope resultante del authorize (comp-1/branch-1)
      expect(prisma.rentalDeposit.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rental: expect.objectContaining({
              operatingCompanyId: 'comp-1',
            }),
          }),
        }),
      );
    });
  });

  describe('Scope vacio — todos los valores en cero', () => {
    it('retorna todos los conteos en cero cuando groupBy devuelve arreglo vacio', async () => {
      const access = buildMockAccess();
      const prisma = buildMockPrisma([]); // sin garantias en el scope

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      const result = await handler.execute(new GetDepositsSummaryQuery('uid-1', 'comp-1', 'branch-1'));

      expect(result.held).toBe(0);
      expect(result.returned).toBe(0);
      expect(result.retained).toBe(0);
      expect(result.partiallyRetained).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.heldAmount).toBe(0);
    });
  });

  describe('Campos del groupBy', () => {
    it('el groupBy agrupa por status e incluye _count id y _sum originalAmount', async () => {
      const access = buildMockAccess();
      const prisma = buildMockPrisma([]);

      const handler = new GetDepositsSummaryHandler(access as any, prisma as any);
      await handler.execute(new GetDepositsSummaryQuery('uid-1', 'comp-1', 'branch-1'));

      expect(prisma.rentalDeposit.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['status'],
          _count: { id: true },
          _sum: { originalAmount: true },
        }),
      );
    });
  });
});
