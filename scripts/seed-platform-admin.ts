/**
 * Seed script: crea un superusuario PLATFORM_ADMIN en Firebase y en la base
 * de datos, y lo asigna a las 4 empresas del Grupo KAIROS.
 *
 * EMPRESAS CREADAS (si no existen):
 *   - VeloxRent
 *   - Casa del Auto
 *   - Motrix
 *   - RENOVA
 *
 * USO:
 *   cd apps/erp-monolithic-api
 *   npx ts-node -P apps/api/tsconfig.json scripts/seed-platform-admin.ts \
 *     --email admin@example.com \
 *     --password "S3cur3P@ss" \
 *     --org-id "uuid-del-grupo"
 *
 * O con variables de entorno equivalentes (útil en CI):
 *   SEED_EMAIL=... SEED_PASSWORD=... SEED_ORG_ID=... npx ts-node ...
 *
 * Credenciales Firebase Admin SDK (requeridas — igual que el backend):
 *   FIREBASE_PROJECT_ID  /  FIREBASE_CLIENT_EMAIL  /  FIREBASE_PRIVATE_KEY
 *   o bien GOOGLE_APPLICATION_CREDENTIALS apuntando a un service account JSON.
 *
 * DATABASE_URL debe estar configurada (igual que en el backend).
 *
 * Idempotente: si el email ya existe en Firebase reutiliza el UID; si ya
 * existe UserProfile para ese UID el script sale sin error. Para forzar
 * recreación elimina primero el usuario de Firebase y la fila de
 * user_profiles.
 */

import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Constantes del negocio — empresas del Grupo KAIROS
// ---------------------------------------------------------------------------

interface CompanySeed {
  name: string;
  branchName: string;
}

const KAIROS_COMPANIES: CompanySeed[] = [
  { name: 'VeloxRent', branchName: 'Casa Central VeloxRent' },
  { name: 'Casa del Auto', branchName: 'Casa Central Casa del Auto' },
  { name: 'Motrix', branchName: 'Casa Central Motrix' },
  { name: 'RENOVA', branchName: 'Casa Central RENOVA' },
];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface SeedConfig {
  email: string;
  password: string;
  organizationId: string;
}

function parseArgs(): SeedConfig {
  const args = process.argv.slice(2);
  const get = (flag: string, envKey: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return process.env[envKey];
  };

  const email = get('--email', 'SEED_EMAIL');
  const password = get('--password', 'SEED_PASSWORD');
  const organizationId = get('--org-id', 'SEED_ORG_ID') ?? randomUUID();

  const missing: string[] = [];
  if (!email) missing.push('--email / SEED_EMAIL');
  if (!password) missing.push('--password / SEED_PASSWORD');

  if (missing.length) {
    console.error('Faltan parámetros requeridos:\n  ' + missing.join('\n  '));
    process.exit(1);
  }

  return {
    email: email!,
    password: password!,
    organizationId,
  };
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK init
// ---------------------------------------------------------------------------

function initFirebase(): void {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && rawKey) {
    const privateKey = rawKey.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    // Intenta Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
    admin.initializeApp();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('\n=== seed-platform-admin ===');
  console.log(`email          : ${config.email}`);
  console.log(`organizationId : ${config.organizationId}`);
  console.log(`empresas       : ${KAIROS_COMPANIES.map((c) => c.name).join(', ')}`);
  console.log('');

  // 1. Firebase: crear o reutilizar usuario
  initFirebase();
  const auth = admin.auth();

  let firebaseUid: string;
  try {
    const existing = await auth.getUserByEmail(config.email);
    firebaseUid = existing.uid;
    console.log(`Firebase: usuario existente reutilizado (uid=${firebaseUid})`);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: config.email,
        password: config.password,
        emailVerified: true,
      });
      firebaseUid = created.uid;
      console.log(`Firebase: usuario creado (uid=${firebaseUid})`);
    } else {
      throw err;
    }
  }

  // 2. Asignar custom claim platform_admin para que el frontend pueda
  //    identificar el rol desde el ID token (opcional pero útil).
  await auth.setCustomUserClaims(firebaseUid, { role: 'PLATFORM_ADMIN' });
  console.log('Firebase: custom claim { role: PLATFORM_ADMIN } asignado');

  // 3. Base de datos
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    // 3a. UserProfile (idempotente)
    const existingProfile = await prisma.userProfile.findUnique({
      where: { firebaseUid },
    });

    if (existingProfile) {
      console.log(`DB: UserProfile ya existe (id=${existingProfile.id}) — sin cambios`);
      console.log('\n✓ Seed completado (usuario ya existía).');
      return;
    }

    // 3b. Crear en transacción:
    //     - UserProfile
    //     - Para cada empresa: Company → Branch → UserCompanyAssignment
    await prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.create({
        data: {
          id: randomUUID(),
          organizationId: config.organizationId,
          firebaseUid,
          requiresPasswordChange: false,
        },
      });
      console.log(`DB: UserProfile creado (id=${profile.id})`);

      for (const companySeed of KAIROS_COMPANIES) {
        const company = await tx.company.create({
          data: {
            id: randomUUID(),
            organizationId: config.organizationId,
            name: companySeed.name,
          },
        });
        console.log(`DB: Company creada — ${company.name} (id=${company.id})`);

        const branch = await tx.branch.create({
          data: {
            id: randomUUID(),
            companyId: company.id,
            name: companySeed.branchName,
          },
        });
        console.log(`DB: Branch creada — ${branch.name} (id=${branch.id})`);

        const assignment = await tx.userCompanyAssignment.create({
          data: {
            id: randomUUID(),
            organizationId: config.organizationId,
            firebaseUid,
            companyId: company.id,
            branchId: branch.id,
            role: 'PLATFORM_ADMIN',
            active: true,
          },
        });
        console.log(`DB: UserCompanyAssignment creado — ${companySeed.name} (id=${assignment.id})`);
      }
    });

    console.log('\n✓ Seed completado exitosamente.');
    console.log(`\nCredenciales:`);
    console.log(`  Email    : ${config.email}`);
    console.log(`  Password : (la que ingresaste)`);
    console.log(`  Org ID   : ${config.organizationId}`);
    console.log(`\nEmpresas asignadas:`);
    for (const c of KAIROS_COMPANIES) {
      console.log(`  • ${c.name}`);
    }
  } finally {
    await prisma.$disconnect();
    await admin.app().delete();
  }
}

main().catch((err) => {
  console.error('\n✗ Error en seed:', err);
  process.exit(1);
});
