import { Prisma } from '@prisma/client';
import { PrismaIdempotencyRepository } from './prisma-idempotency.repository';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

function buildPrisma(existing: Record<string, unknown> | null, createFails = true) {
  return {
    idempotencyKey: {
      create: createFails ? jest.fn().mockRejectedValue(uniqueViolation()) : jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(existing),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

const FUTURE = new Date(Date.now() + 60_000);
const INPUT = { key: 'uid:k', requestHash: 'h1', ttlMs: 1000 };

describe('PrismaIdempotencyRepository.claim (reserva atomica via UNIQUE)', () => {
  it('CLAIMED cuando el INSERT gana (clave nueva), guardando la fila "en curso" (status_code NULL)', async () => {
    const prisma = buildPrisma(null, false);
    const repo = new PrismaIdempotencyRepository(prisma as any);

    await expect(repo.claim(INPUT)).resolves.toEqual({ status: 'CLAIMED' });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: 'uid:k', requestHash: 'h1', statusCode: null }),
    });
  });

  it('IN_PROGRESS cuando otra solicitud ya reservo la clave y no termino', async () => {
    const repo = new PrismaIdempotencyRepository(buildPrisma({ requestHash: 'h1', statusCode: null, responseBody: null, expiresAt: FUTURE }) as any);

    await expect(repo.claim(INPUT)).resolves.toEqual({ status: 'IN_PROGRESS' });
  });

  it('REPLAY con la respuesta guardada cuando la clave ya se completo con el mismo contenido', async () => {
    const repo = new PrismaIdempotencyRepository(buildPrisma({ requestHash: 'h1', statusCode: 201, responseBody: { id: 'x' }, expiresAt: FUTURE }) as any);

    await expect(repo.claim(INPUT)).resolves.toEqual({
      status: 'REPLAY',
      record: { requestHash: 'h1', statusCode: 201, responseBody: { id: 'x' } },
    });
  });

  it('MISMATCH cuando la clave existe con otro contenido', async () => {
    const repo = new PrismaIdempotencyRepository(buildPrisma({ requestHash: 'otro', statusCode: 201, responseBody: {}, expiresAt: FUTURE }) as any);

    await expect(repo.claim(INPUT)).resolves.toEqual({ status: 'MISMATCH' });
  });

  it('una clave vencida se elimina de forma condicional y se reintenta la reserva', async () => {
    const past = new Date(Date.now() - 1000);
    const prisma = buildPrisma({ requestHash: 'h1', statusCode: 201, responseBody: {}, expiresAt: past });
    prisma.idempotencyKey.create.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce({});
    const repo = new PrismaIdempotencyRepository(prisma as any);

    await expect(repo.claim(INPUT)).resolves.toEqual({ status: 'CLAIMED' });
    expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({ where: { key: 'uid:k', expiresAt: past } });
  });

  it('release solo borra una reserva EN CURSO, nunca una respuesta completada', async () => {
    const prisma = buildPrisma(null);
    await new PrismaIdempotencyRepository(prisma as any).release('uid:k');

    expect(prisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({ where: { key: 'uid:k', statusCode: null } });
  });
});
