import type { Prisma } from '@prisma/client';
import { PrismaIncidentRepository } from './prisma-incident.repository';
import { PrismaIncidentLinksAdapter } from './prisma-incident-links.adapter';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { IncidentNotFoundError, IncidentNotOpenError, IncidentVersionConflictError } from '../../domain/incident-errors';

describe('PrismaIncidentRepository / PrismaIncidentLinksAdapter', () => {
  const now = new Date('2026-10-06T15:00:00.000Z');
  const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };
  const actionRow = { id: 'act-2', incidentId: 'inc-1', kind: 'ACTION', description: 'x', authorUserId: 'uid-1', createdAt: now };
  const row = {
    id: 'inc-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    branchId: 'branch-1',
    rentalId: 'rent-1',
    returnId: null,
    type: 'KEY_LOSS',
    severity: 'LEVE',
    status: 'ABIERTA',
    description: 'Llave perdida',
    suggestion: null,
    reportedAt: now,
    responsibleUserId: 'uid-1',
    resolutionSummary: null,
    resolvedAt: null,
    createdAt: now,
    createdBy: 'uid-1',
    updatedAt: now,
    updatedBy: 'uid-1',
    version: 2,
    actions: [{ ...actionRow, id: 'act-1', kind: 'REPORTED' }, actionRow],
  };

  function build() {
    const client = {
      incident: {
        create: jest.fn().mockResolvedValue(row),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn().mockResolvedValue(row),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      incidentAction: { create: jest.fn().mockResolvedValue(actionRow) },
      rental: { findFirst: jest.fn() },
      rentalReturn: { findFirst: jest.fn() },
    };
    const tx = client as unknown as Prisma.TransactionClient;
    const repo = new PrismaIncidentRepository(client as unknown as PrismaService);
    return { client, tx, repo };
  }

  it('create inserta la incidencia ABIERTA junto con la entrada REPORTED en una sola escritura', async () => {
    const { client, tx, repo } = build();

    const result = await repo.create(
      {
        ...scope,
        rentalId: 'rent-1',
        type: 'KEY_LOSS',
        severity: 'LEVE',
        description: 'Llave perdida',
        reportedAt: now,
        responsibleUserId: 'uid-1',
        createdBy: 'uid-1',
        now,
      },
      tx,
    );

    const data = client.incident.create.mock.calls[0][0].data;
    expect(data.actions.create).toEqual({ kind: 'REPORTED', description: 'Llave perdida', authorUserId: 'uid-1', createdAt: now });
    expect(data.status).toBeUndefined();
    expect(result.actions).toHaveLength(2);
    expect(result.createdBy).toBe('uid-1');
  });

  it('findById filtra siempre por id + organizacion + empresa + sede (aislamiento multiempresa)', async () => {
    const { client, repo } = build();
    client.incident.findFirst.mockResolvedValue(null);
    await expect(repo.findById('inc-1', scope)).resolves.toBeNull();
    expect(client.incident.findFirst.mock.calls[0][0].where).toEqual({ id: 'inc-1', ...scope });
  });

  it('list: scope + filtros + keyset (createdAt DESC, id DESC) y limite', async () => {
    const { client, repo } = build();
    client.incident.findMany.mockResolvedValue([{ ...row, actions: undefined }]);
    const cursor = { createdAt: now, id: 'inc-0' };

    const result = await repo.list({ ...scope, type: 'KEY_LOSS', severity: 'LEVE', status: 'ABIERTA', rentalId: 'rent-1', returnId: 'ret-1', limit: 10, cursor });

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('actions');
    expect(client.incident.findMany).toHaveBeenCalledWith({
      where: {
        ...scope,
        type: 'KEY_LOSS',
        severity: 'LEVE',
        status: 'ABIERTA',
        rentalId: 'rent-1',
        returnId: 'ret-1',
        OR: [{ createdAt: { lt: now } }, { createdAt: now, id: { lt: 'inc-0' } }],
      },
      take: 10,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });

  describe('appendAction (append-only con If-Match)', () => {
    const input = {
      id: 'inc-1',
      scope,
      expectedVersion: 2,
      kind: 'CLOSED' as const,
      description: 'Resuelta',
      authorUserId: 'uid-1',
      now,
      nextStatus: 'CERRADA' as const,
      resolutionSummary: 'Resuelta',
      resolvedAt: now,
    };

    it('UPDATE condicionado por scope + version + ABIERTA (version+1) y luego INSERT de la entrada', async () => {
      const { client, tx, repo } = build();
      client.incident.updateMany.mockResolvedValue({ count: 1 });

      const result = await repo.appendAction(input, tx);

      expect(client.incident.updateMany).toHaveBeenCalledWith({
        where: { id: 'inc-1', ...scope, version: 2, status: 'ABIERTA' },
        data: {
          status: 'CERRADA',
          resolutionSummary: 'Resuelta',
          resolvedAt: now,
          updatedBy: 'uid-1',
          updatedAt: now,
          version: { increment: 1 },
        },
      });
      expect(client.incidentAction.create).toHaveBeenCalledWith({
        data: { incidentId: 'inc-1', kind: 'CLOSED', description: 'Resuelta', authorUserId: 'uid-1', createdAt: now },
      });
      expect(result.action.id).toBe('act-2');
      expect(result.incident.actions).toHaveLength(2);
    });

    it('sin filas actualizadas: inexistente -> 404, no ABIERTA -> NOT_OPEN, version distinta -> VERSION_CONFLICT, y nunca inserta la entrada', async () => {
      const { client, tx, repo } = build();
      client.incident.updateMany.mockResolvedValue({ count: 0 });

      client.incident.findFirst.mockResolvedValueOnce(null);
      await expect(repo.appendAction(input, tx)).rejects.toThrow(IncidentNotFoundError);

      client.incident.findFirst.mockResolvedValueOnce({ status: 'VIA_LEGAL' });
      await expect(repo.appendAction(input, tx)).rejects.toThrow(IncidentNotOpenError);

      client.incident.findFirst.mockResolvedValueOnce({ status: 'ABIERTA' });
      await expect(repo.appendAction(input, tx)).rejects.toThrow(IncidentVersionConflictError);

      expect(client.incidentAction.create).not.toHaveBeenCalled();
    });
  });

  it('el repositorio no expone ninguna operacion de update/delete de entradas del historial', () => {
    const methods = Object.getOwnPropertyNames(PrismaIncidentRepository.prototype);
    expect(methods.filter((m) => /update|delete|remove/i.test(m))).toEqual([]);
  });

  it('el adaptador de vinculos filtra rental y return por scope completo', async () => {
    const { client, tx } = build();
    const adapter = new PrismaIncidentLinksAdapter(client as unknown as PrismaService);
    client.rental.findFirst.mockResolvedValue({ id: 'rent-1' });
    client.rentalReturn.findFirst.mockResolvedValue({ id: 'ret-1', rentalId: 'rent-1' });

    await expect(adapter.findRental('rent-1', scope, tx)).resolves.toEqual({ id: 'rent-1' });
    await expect(adapter.findReturn('ret-1', scope, tx)).resolves.toEqual({ id: 'ret-1', rentalId: 'rent-1' });
    expect(client.rental.findFirst.mock.calls[0][0].where).toEqual({ id: 'rent-1', ...scope });
    expect(client.rentalReturn.findFirst.mock.calls[0][0].where).toEqual({ id: 'ret-1', ...scope });
  });
});
