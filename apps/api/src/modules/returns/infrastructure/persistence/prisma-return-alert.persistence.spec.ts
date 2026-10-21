import { PrismaReturnAlertPersistence } from './prisma-return-alert.persistence';
import { PrismaService } from '../../../../common/persistence/prisma.service';

const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };

function build(lateIds: string[] = []) {
  const prisma = {
    rentalReturn: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue(lateIds.map((id) => ({ id }))),
  };
  return { prisma, persistence: new PrismaReturnAlertPersistence(prisma as unknown as PrismaService) };
}

describe('PrismaReturnAlertPersistence', () => {
  it('solo alertas de reloj: no ejecuta el SQL de retraso', async () => {
    const { prisma, persistence } = build();
    const receivedBefore = new Date('2026-10-05T12:00:00Z');
    await persistence.listCandidates({ ...scope, receivedBefore, includeLateCharge: false, limit: 10 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    const where = prisma.rentalReturn.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject(scope);
    expect(where.OR).toHaveLength(1);
    expect(where.OR[0].receivedAt).toEqual({ not: null, lte: receivedBefore });
  });

  it('solo retraso (receivedBefore null): evalúa el retraso en SQL con la tolerancia de 30 min y consulta esos ids', async () => {
    const { prisma, persistence } = build(['ret-9']);
    await persistence.listCandidates({ ...scope, receivedBefore: null, includeLateCharge: true, limit: 10 });
    const sql = prisma.$queryRaw.mock.calls[0][0];
    const text = (sql.strings as string[]).join('?');
    expect(text).toContain('late_charge_amount IS NULL');
    expect(text).toContain('received_at > scheduled_at');
    expect(sql.values).toEqual(expect.arrayContaining([30, 10]));
    const where = prisma.rentalReturn.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ id: { in: ['ret-9'] } }]);
  });

  it('sin candidatas por retraso y sin alertas de reloj no consulta nada más', async () => {
    const { prisma, persistence } = build([]);
    expect(await persistence.listCandidates({ ...scope, receivedBefore: null, includeLateCharge: true, limit: 10 })).toEqual([]);
    expect(prisma.rentalReturn.findMany).not.toHaveBeenCalled();
  });
});
