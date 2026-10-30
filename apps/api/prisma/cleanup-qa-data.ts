/**
 * Limpieza de datos de prueba (QA) en LOCAL: cliente «X» con DNI 123 y ficha de personal «QA-Editado Dos».
 *
 * SEGURIDAD: aborta si NODE_ENV=production o si DATABASE_URL/DIRECT_URL no son locales. Por defecto es SIMULACION:
 * intenta el borrado dentro de una transaccion y la revierte. Solo con --apply se confirma.
 * Si un registro tiene datos dependientes (FK), NO se fuerza: se informa cual tabla lo bloquea y se sigue con el resto.
 *
 * USO (desde la raiz del repo):
 *   npm run cleanup:qa            # simulacion
 *   npm run cleanup:qa -- --apply # borra de verdad
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { assertLocalDatabaseUrl, assertNotProduction, parseEnvFile } from './seed-demo.lib';

class DryRunRollback extends Error {}

function loadLocalEnv(): void {
  try {
    const parsed = parseEnvFile(readFileSync(join(__dirname, '..', '.env'), 'utf8'));
    for (const key of ['DATABASE_URL', 'DIRECT_URL', 'NODE_ENV']) {
      if (process.env[key] === undefined && parsed[key] !== undefined) process.env[key] = parsed[key];
    }
  } catch {
    // Sin .env: se usan las variables del proceso.
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  assertNotProduction(process.env);
  assertLocalDatabaseUrl('DATABASE_URL', process.env.DATABASE_URL);
  if (process.env.DIRECT_URL) assertLocalDatabaseUrl('DIRECT_URL', process.env.DIRECT_URL);
  const apply = process.argv.includes('--apply');
  console.log(apply ? '== APLICANDO borrado ==' : '== SIMULACION (no se borra nada; usa --apply) ==');

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const customers = (await prisma.customer.findMany({ where: { documentNumber: '123' } })).filter(
      (c) => c.fullName.trim().toUpperCase() === 'X',
    );
    const employees = await prisma.employee.findMany({ where: { fullName: { contains: 'QA-Editado Dos', mode: 'insensitive' } } });
    console.log(`Clientes encontrados: ${customers.length}; fichas encontradas: ${employees.length}`);

    const targets: Array<{ label: string; run: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<unknown> }> = [
      ...customers.map((c) => ({ label: `Cliente ${c.id} («${c.fullName}», doc ${c.documentNumber})`, run: (tx: any) => tx.customer.delete({ where: { id: c.id } }) })),
      ...employees.map((e) => ({ label: `Ficha ${e.id} («${e.fullName}»)`, run: (tx: any) => tx.employee.delete({ where: { id: e.id } }) })),
    ];

    for (const t of targets) {
      try {
        await prisma.$transaction(async (tx) => {
          await t.run(tx);
          if (!apply) throw new DryRunRollback();
        });
        console.log(`  OK   ${t.label} -> borrado`);
      } catch (err) {
        if (err instanceof DryRunRollback) console.log(`  OK   ${t.label} -> se podria borrar`);
        else console.log(`  BLOQUEADO ${t.label} -> ${(err as Error).message.split('\n').slice(-3).join(' ').trim()}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
