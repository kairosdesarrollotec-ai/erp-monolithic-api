import { PrismaRetentionPurgeRepository } from './prisma-retention-purge.repository';

describe('PrismaRetentionPurgeRepository', () => {
  const build = () => {
    const sql: string[] = [];
    const prisma = {
      $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
        sql.push(strings.join('?'));
        return 2;
      }),
    };
    return { sql, repo: new PrismaRetentionPurgeRepository(prisma as never) };
  };

  it('DASHBOARD_ITEMS_SEEN solo borra items ya vistos (dismissed_at NO nulo); los no vistos jamas (Respuestas #34)', async () => {
    const { sql, repo } = build();
    await expect(repo.purgeBatch('DASHBOARD_ITEMS_SEEN', new Date(), 10)).resolves.toBe(2);
    expect(sql[0]).toContain('FROM "dashboard_items"');
    expect(sql[0]).toContain('"dismissed_at" IS NOT NULL AND "dismissed_at" <');
    expect(sql[0]).not.toMatch(/"dismissed_at" IS NULL/);
    expect(sql[0]).toContain('FOR UPDATE SKIP LOCKED');
  });

  it.each(['IDEMPOTENCY_KEYS', 'OUTBOX_PROCESSED', 'OUTBOX_DEAD_LETTER'] as const)('%s nunca toca tablas de evidencia ni dashboard', async (target) => {
    const { sql, repo } = build();
    await repo.purgeBatch(target, new Date(), 10);
    expect(sql[0]).not.toMatch(/evidence|dashboard_items|audit_events/i);
  });
});
