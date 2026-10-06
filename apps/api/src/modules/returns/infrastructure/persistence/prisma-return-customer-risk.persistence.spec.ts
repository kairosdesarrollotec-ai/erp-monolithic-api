import type { Prisma } from '@prisma/client';
import { PrismaReturnCustomerRiskPersistence } from './prisma-return-customer-risk.persistence';

describe('PrismaReturnCustomerRiskPersistence (semáforo de solo avance)', () => {
  function build(initial: string | null) {
    let status = initial;
    const customer = {
      findFirst: jest.fn(async () => (status === null ? null : { status })),
      updateMany: jest.fn(async (args: { data: { status: string }; where: { status: { notIn: string[] } } }) => {
        if (status !== null && !args.where.status.notIn.includes(status)) {
          status = args.data.status;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    };
    const tx = { customer } as unknown as Prisma.TransactionClient;
    return { customer, tx, persistence: new PrismaReturnCustomerRiskPersistence() };
  }

  const input = (target: 'NORMAL' | 'AMBAR' | 'ROJO') => ({ customerId: 'cust-1', operatingCompanyId: 'comp-1', target });

  it('NORMAL -> AMBAR y AMBAR -> ROJO actualizan Customer.status con filtro de solo avance', async () => {
    const a = build('NORMAL');
    await expect(a.persistence.escalate(input('AMBAR'), a.tx)).resolves.toEqual({ previous: 'NORMAL', current: 'AMBAR' });
    expect(a.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'cust-1', operatingCompanyId: 'comp-1', status: { notIn: ['AMBAR', 'ROJO'] } },
      data: { status: 'AMBAR' },
    });

    const r = build('AMBAR');
    await expect(r.persistence.escalate(input('ROJO'), r.tx)).resolves.toEqual({ previous: 'AMBAR', current: 'ROJO' });
  });

  it('nunca degrada: ROJO ante AMBAR/NORMAL, o AMBAR ante NORMAL, no escribe', async () => {
    for (const [initial, target] of [
      ['ROJO', 'AMBAR'],
      ['ROJO', 'NORMAL'],
      ['AMBAR', 'NORMAL'],
      ['AMBAR', 'AMBAR'],
    ] as const) {
      const ctx = build(initial);
      await expect(ctx.persistence.escalate(input(target), ctx.tx)).resolves.toEqual({ previous: initial, current: initial });
      expect(ctx.customer.updateMany).not.toHaveBeenCalled();
    }
  });

  it('valores legados (SIN_OBSERVACION) se tratan como NORMAL y pueden avanzar', async () => {
    const ctx = build('SIN_OBSERVACION');
    await expect(ctx.persistence.escalate(input('AMBAR'), ctx.tx)).resolves.toEqual({ previous: 'NORMAL', current: 'AMBAR' });
  });

  it('target NORMAL es una lectura pura', async () => {
    const ctx = build('AMBAR');
    await expect(ctx.persistence.escalate(input('NORMAL'), ctx.tx)).resolves.toEqual({ previous: 'AMBAR', current: 'AMBAR' });
    expect(ctx.customer.updateMany).not.toHaveBeenCalled();
  });

  it('cliente inexistente en la empresa -> sin escritura', async () => {
    const ctx = build(null);
    await expect(ctx.persistence.escalate(input('ROJO'), ctx.tx)).resolves.toEqual({ previous: 'NORMAL', current: 'NORMAL' });
    expect(ctx.customer.updateMany).not.toHaveBeenCalled();
  });
});
