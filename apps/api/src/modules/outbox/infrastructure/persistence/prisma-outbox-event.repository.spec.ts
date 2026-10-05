import { PrismaService } from '../../../../common/persistence/prisma.service';
import { PrismaOutboxEventRepository } from './prisma-outbox-event.repository';

function buildPrisma(createMock = jest.fn().mockResolvedValue(undefined)) {
  return {
    outboxEvent: { create: createMock },
  } as unknown as jest.Mocked<PrismaService>;
}

describe('PrismaOutboxEventRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  const input = {
    aggregateType: 'Reservation',
    aggregateId: 'res-1',
    eventType: 'ReservationCreated',
    payload: { organizationId: 'org-1' },
  };

  it('escribe el evento en outbox_events usando PrismaService directo cuando no hay tx', async () => {
    const createMock = jest.fn().mockResolvedValue(undefined);
    const repo = new PrismaOutboxEventRepository(buildPrisma(createMock));

    await repo.publish(input);

    expect(createMock).toHaveBeenCalledWith({
      data: {
        aggregateType: 'Reservation',
        aggregateId: 'res-1',
        eventType: 'ReservationCreated',
        payload: { organizationId: 'org-1' },
      },
    });
  });

  it('usa el TransactionClient cuando se pasa tx', async () => {
    const prisma = buildPrisma();
    const txCreate = jest.fn().mockResolvedValue(undefined);
    const tx = { outboxEvent: { create: txCreate } } as unknown as Parameters<typeof repo.publish>[1];
    const repo = new PrismaOutboxEventRepository(prisma);

    await repo.publish(input, tx);

    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'ReservationCreated' }) }));
    // PrismaService directo NO debe haberse usado
    expect((prisma.outboxEvent.create as jest.Mock).mock.calls).toHaveLength(0);
  });

  it('propaga el error si la escritura falla', async () => {
    const createMock = jest.fn().mockRejectedValue(new Error('DB error'));
    const repo = new PrismaOutboxEventRepository(buildPrisma(createMock));

    await expect(repo.publish(input)).rejects.toThrow('DB error');
  });
});
