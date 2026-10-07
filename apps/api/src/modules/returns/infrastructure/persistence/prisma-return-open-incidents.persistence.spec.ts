import type { Prisma } from '@prisma/client';
import { PrismaReturnOpenIncidentsPersistence } from './prisma-return-open-incidents.persistence';
import { PrismaService } from '../../../../common/persistence/prisma.service';

describe('PrismaReturnOpenIncidentsPersistence (DEV-09)', () => {
  const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };

  it('consulta solo incidencias ABIERTA de la empresa ligadas al alquiler o a la devolucion, dentro de la tx', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'inc-1' }, { id: 'inc-2' }]);
    const tx = { incident: { findMany } } as unknown as Prisma.TransactionClient;
    const persistence = new PrismaReturnOpenIncidentsPersistence({} as PrismaService);

    const ids = await persistence.findOpenIncidentIds({ rentalId: 'rent-1', returnId: 'ret-1', scope }, tx);

    expect(ids).toEqual(['inc-1', 'inc-2']);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        status: 'ABIERTA',
        OR: [{ rentalId: 'rent-1' }, { returnId: 'ret-1' }],
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('sin tx usa el cliente Prisma del servicio', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const persistence = new PrismaReturnOpenIncidentsPersistence({ incident: { findMany } } as unknown as PrismaService);
    await expect(persistence.findOpenIncidentIds({ rentalId: 'rent-1', returnId: 'ret-1', scope })).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
