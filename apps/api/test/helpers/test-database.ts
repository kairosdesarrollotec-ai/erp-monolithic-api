import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

// En ESM (Jest con --experimental-vm-modules) __dirname no existe y tsc compila
// este archivo como CommonJS (sin import.meta): se resuelve desde el cwd, que es
// apps/api al correr `npm run test:integration --workspace apps/api`.
function resolveSchemaPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    path.resolve(process.cwd(), 'apps/api/prisma/schema.prisma'),
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error(`No se encontró schema.prisma desde ${process.cwd()}`);
  return found;
}

export interface TestDatabase {
  container?: StartedPostgreSqlContainer;
  databaseUrl: string;
  prisma: PrismaClient;
  stop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('kairos_test')
    .withUsername('kairos')
    .withPassword('kairos_test_pw')
    .start();

  const databaseUrl = container.getConnectionUri();

  const schemaPath = resolveSchemaPath();
  execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  await prisma.$connect();

  return {
    container,
    databaseUrl,
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}

export async function getTestDatabase(): Promise<TestDatabase> {
  if (process.env.CI && process.env.DATABASE_URL) {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
    await prisma.$connect();
    return {
      databaseUrl: process.env.DATABASE_URL,
      prisma,
      stop: async () => {
        await prisma.$disconnect();
      },
    };
  }

  return createTestDatabase();
}
