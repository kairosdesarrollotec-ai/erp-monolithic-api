/**
 * Seed de DEMOSTRACION para pruebas manuales en LOCAL (guia: claude/Guia_Pruebas_Manuales_ERP_2026-10-19.md).
 *
 * Crea, sobre una empresa/sede YA existente (la que deja `npm run seed:platform-admin`), datos ficticios marcados
 * «DEMO»: catalogo de areas de RR.HH., clientes, vehiculos (con capacidad, garantia y precio de combustible),
 * personal, una plantilla de contrato activa, una consulta, dos reservas y cuatro alquileres.
 *
 * SEGURIDAD
 *  - Aborta si NODE_ENV=production.
 *  - Aborta si DATABASE_URL (o DIRECT_URL, si existe) no apunta a localhost / 127.0.0.1 / ::1.
 *  - No crea usuarios ni credenciales (los usuarios de Firebase los crea el equipo; ver la guia, seccion 0).
 *
 * IDEMPOTENTE: ids deterministas + `createMany({ skipDuplicates: true })`. Re-ejecutarlo no duplica ni pisa nada.
 *
 * USO (desde la raiz del repo):
 *   npm run seed:demo                       # empresa = primera cuyo nombre contenga «veloxrent»
 *   npm run seed:demo -- --dry-run          # valida y muestra lo que sembraria, sin escribir
 *   npm run seed:demo -- --company-id <uuid> [--branch-id <uuid>]
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { assertLocalDatabaseUrl, assertNotProduction, buildDemoDataset, parseEnvFile } from './seed-demo.lib';

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
}

/** Carga apps/api/.env solo para las claves que faltan (el guard debe ver el mismo valor que usara Prisma). */
function loadLocalEnv(): void {
  try {
    const parsed = parseEnvFile(readFileSync(join(__dirname, '..', '.env'), 'utf8'));
    for (const key of ['DATABASE_URL', 'DIRECT_URL', 'NODE_ENV']) {
      if (process.env[key] === undefined && parsed[key] !== undefined) process.env[key] = parsed[key];
    }
  } catch {
    // Sin .env: se usan las variables de entorno del proceso.
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  assertNotProduction(process.env);
  assertLocalDatabaseUrl('DATABASE_URL', process.env.DATABASE_URL);
  if (process.env.DIRECT_URL) assertLocalDatabaseUrl('DIRECT_URL', process.env.DIRECT_URL);
  const dryRun = process.argv.includes('--dry-run');

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const companyId = argValue('--company-id');
    const company = companyId
      ? await prisma.company.findUnique({ where: { id: companyId } })
      : await prisma.company.findFirst({ where: { name: { contains: 'veloxrent', mode: 'insensitive' } }, orderBy: { createdAt: 'asc' } });
    if (!company) {
      throw new Error('No hay empresa donde sembrar. Corre antes `npm run seed:platform-admin` (crea VeloxRent y sus sedes) o pasa --company-id.');
    }
    const branchId = argValue('--branch-id');
    const branch = branchId
      ? await prisma.branch.findFirst({ where: { id: branchId, companyId: company.id } })
      : await prisma.branch.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
    if (!branch) {
      throw new Error(`La empresa «${company.name}» no tiene la sede indicada / ninguna sede.`);
    }

    console.log('\n=== seed-demo (solo local) ===');
    console.log(`empresa : ${company.name} (${company.id})`);
    console.log(`sede    : ${branch.name} (${branch.id})`);
    console.log(`org     : ${company.organizationId}`);

    const data = buildDemoDataset({ organizationId: company.organizationId, companyId: company.id, branchId: branch.id, now: new Date() });
    if (dryRun) {
      for (const [table, rows] of Object.entries(data)) console.log(`  [dry-run] ${table}: ${rows.length}`);
      console.log('\nDry-run: no se escribio nada.');
      return;
    }

    const opts = { skipDuplicates: true } as const;
    const created = await prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};
      counts.hrAreas = (await tx.hrArea.createMany({ data: data.hrAreas, ...opts })).count;
      counts.customers = (await tx.customer.createMany({ data: data.customers, ...opts })).count;
      counts.vehicles = (await tx.vehicle.createMany({ data: data.vehicles, ...opts })).count;
      counts.employees = (await tx.employee.createMany({ data: data.employees, ...opts })).count;
      counts.templates = (await tx.template.createMany({ data: data.templates, ...opts })).count;
      counts.inquiries = (await tx.inquiry.createMany({ data: data.inquiries, ...opts })).count;
      counts.reservations = (await tx.reservation.createMany({ data: data.reservations, ...opts })).count;
      counts.vehicleCommitments = (await tx.vehicleCommitment.createMany({ data: data.vehicleCommitments, ...opts })).count;
      counts.rentals = (await tx.rental.createMany({ data: data.rentals, ...opts })).count;
      counts.rentalParties = (await tx.rentalParty.createMany({ data: data.rentalParties, ...opts })).count;
      counts.rentalContracts = (await tx.rentalContract.createMany({ data: data.rentalContracts, ...opts })).count;
      counts.rentalDeposits = (await tx.rentalDeposit.createMany({ data: data.rentalDeposits, ...opts })).count;
      counts.notaryEvaluations = (await tx.notaryEvaluation.createMany({ data: data.notaryEvaluations, ...opts })).count;
      return counts;
    });

    console.log('\nFilas NUEVAS por tabla (0 = ya existian):');
    for (const [table, count] of Object.entries(created)) console.log(`  ${table}: ${count}`);
    console.log('\n✓ Seed demo completado. Todos los datos llevan la marca DEMO.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('\n✗ seed-demo:', err instanceof Error ? err.message : err);
  process.exit(1);
});
