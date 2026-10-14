import type { Prisma } from '@prisma/client';
import { PrismaReturnReminderPersistence } from './prisma-return-reminder.persistence';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { ReturnReminderNotFoundError, ReturnReminderVersionConflictError } from '../../domain/return-errors';

const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };
const row = {
  id: 'rem-1',
  organizationId: 'org-1',
  operatingCompanyId: 'comp-1',
  branchId: 'branch-1',
  returnId: 'ret-1',
  status: 'SENT',
  dueAt: new Date('2026-10-05T07:00:00Z'),
  messageText: 'texto',
  generatedAt: new Date('2026-10-05T07:05:00Z'),
  sentAt: new Date('2026-10-05T07:10:00Z'),
  sentBy: 'uid-1',
  resultNote: null,
  attempts: 1,
  version: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PrismaReturnReminderPersistence (BR-DEV-004)', () => {
  it('findCandidates: PROGRAMADA, sin recordatorio y hora pactada dentro de la ventana', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'ret-1',
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        scheduledAt: new Date('2026-10-05T14:00:00Z'),
        customer: { fullName: 'Juan Perez' },
        vehicle: { plate: 'ABC-123' },
      },
    ]);
    const persistence = new PrismaReturnReminderPersistence({ rentalReturn: { findMany } } as unknown as PrismaService);
    const since = new Date('2026-10-04T12:00:00Z');
    const until = new Date('2026-10-05T15:00:00Z');

    const result = await persistence.findCandidates(since, until, 200);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PROGRAMADA', scheduledAt: { gte: since, lte: until }, reminder: { is: null } },
        take: 200,
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({ returnId: 'ret-1', customerName: 'Juan Perez', vehiclePlate: 'ABC-123' }),
    ]);
  });

  it('createPending: createMany con skipDuplicates (idempotente entre réplicas); vacío no consulta', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const persistence = new PrismaReturnReminderPersistence({ returnReminder: { createMany } } as unknown as PrismaService);
    expect(await persistence.createPending([])).toBe(0);
    expect(createMany).not.toHaveBeenCalled();

    const count = await persistence.createPending([
      { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1', returnId: 'ret-1', dueAt: new Date(), messageText: 't' },
    ]);
    expect(count).toBe(1);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  describe('registerResult', () => {
    const input = {
      returnId: 'ret-1',
      scope,
      expectedVersion: 1,
      status: 'SENT' as const,
      sentAt: new Date('2026-10-05T07:10:00Z'),
      sentBy: 'uid-1',
      resultNote: null,
    };

    it('actualiza con concurrencia optimista (version esperada, nunca sobre SENT) e incrementa version y attempts', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const findFirstOrThrow = jest.fn().mockResolvedValue(row);
      const tx = { returnReminder: { updateMany, findFirstOrThrow } } as unknown as Prisma.TransactionClient;

      const result = await new PrismaReturnReminderPersistence({} as PrismaService).registerResult(input, tx);

      expect(updateMany).toHaveBeenCalledWith({
        where: { returnId: 'ret-1', ...scope, version: 1, status: { not: 'SENT' } },
        data: expect.objectContaining({ status: 'SENT', attempts: { increment: 1 }, version: { increment: 1 } }),
      });
      expect(result).toMatchObject({ status: 'SENT', version: 2, attempts: 1 });
    });

    it('0 filas y el recordatorio existe -> conflicto de versión (412); no existe -> 404', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const findFirst = jest.fn().mockResolvedValueOnce({ id: 'rem-1' }).mockResolvedValueOnce(null);
      const tx = { returnReminder: { updateMany, findFirst } } as unknown as Prisma.TransactionClient;
      const persistence = new PrismaReturnReminderPersistence({} as PrismaService);

      await expect(persistence.registerResult(input, tx)).rejects.toThrow(ReturnReminderVersionConflictError);
      await expect(persistence.registerResult(input, tx)).rejects.toThrow(ReturnReminderNotFoundError);
    });
  });

  it('list: filtra por scope y estados, más urgente primero, con datos de contacto', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        ...row,
        status: 'PENDING',
        sentAt: null,
        rentalReturn: {
          id: 'ret-1',
          rentalId: 'rent-1',
          status: 'PROGRAMADA',
          scheduledAt: new Date('2026-10-05T14:00:00Z'),
          customer: { fullName: 'Juan Perez', phone: '999888777' },
          vehicle: { plate: 'ABC-123' },
        },
      },
    ]);
    const persistence = new PrismaReturnReminderPersistence({ returnReminder: { findMany } } as unknown as PrismaService);

    const items = await persistence.list({ ...scope, statuses: ['PENDING', 'FAILED'], limit: 50 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...scope, status: { in: ['PENDING', 'FAILED'] } },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    );
    expect(items[0]).toMatchObject({ returnId: 'ret-1', customerPhone: '999888777', vehiclePlate: 'ABC-123' });
    expect(items[0].reminder.status).toBe('PENDING');
  });
});
