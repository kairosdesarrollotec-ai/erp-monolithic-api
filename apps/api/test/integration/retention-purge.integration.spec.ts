import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getTestDatabase, TestDatabase } from '../helpers/test-database';
import { PrismaRetentionPurgeRepository } from '../../src/modules/retention/infrastructure/prisma-retention-purge.repository';
import { RetentionPurgeService } from '../../src/modules/retention/application/retention-purge.service';
import { loadRetentionConfig } from '../../src/modules/retention/retention.config';

/** Purga de retención contra Postgres real (Testcontainers o el servicio de CI). L-02, 16-oct-2026. */
describe('Purga de retención (Postgres real)', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  const DAY = 86_400_000;
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  beforeAll(async () => {
    db = await getTestDatabase();
    prisma = db.prisma;
  }, 60000);
  afterAll(async () => db?.stop());

  const makeService = (batchSize = 2) =>
    new RetentionPurgeService(
      new PrismaRetentionPurgeRepository(prisma as never),
      { now: () => now },
      loadRetentionConfig({ RETENTION_PURGE_BATCH_SIZE: String(batchSize), RETENTION_PURGE_BATCH_PAUSE_MS: '0' }),
    );

  const outbox = (data: Record<string, unknown>) =>
    prisma.outboxEvent.create({
      data: { aggregateType: 'T', aggregateId: randomUUID(), eventType: 'E', payload: {}, ...data } as never,
    });

  it('borra idempotencia vencida >365 d y outbox procesado/dead-letter >365 d, por lotes, y conserva lo reciente y audit_events', async () => {
    const tag = randomUUID();
    for (const [i, d] of [400, 380, 370, 100].entries()) {
      await prisma.idempotencyKey.create({ data: { key: `${tag}-${i}`, requestHash: 'h', expiresAt: ago(d) } });
    }
    await outbox({ processedAt: ago(400) });
    await outbox({ processedAt: ago(10) });
    await outbox({ deadLetteredAt: ago(500) });
    await outbox({ deadLetteredAt: ago(5) });
    await outbox({}); // pendiente: nunca se purga
    const auditBefore = await prisma.auditEvent.count();

    const results = await makeService(2).run();
    expect(results[0]).toMatchObject({ target: 'IDEMPOTENCY_KEYS', deleted: 3, batches: 2 });
    expect(results[1].deleted).toBe(1);
    expect(results[2].deleted).toBe(1);

    expect(await prisma.idempotencyKey.count({ where: { key: { startsWith: tag } } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { aggregateType: 'T', processedAt: null, deadLetteredAt: null } })).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(auditBefore);

    // idempotente
    expect((await makeService(2).run()).every((r) => r.deleted === 0)).toBe(true);
  });

  it('dos purgas concurrentes no se pisan (SKIP LOCKED) y el total borrado es exacto', async () => {
    const tag = randomUUID();
    await prisma.idempotencyKey.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ key: `${tag}-c${i}`, requestHash: 'h', expiresAt: ago(800) })),
    });
    const [a, b] = await Promise.all([makeService(5).run(), makeService(5).run()]);
    expect(a[0].deleted + b[0].deleted).toBe(25);
    expect(await prisma.idempotencyKey.count({ where: { key: { startsWith: tag } } })).toBe(0);
  });
});
