/**
 * Seed script: crea un superusuario PLATFORM_ADMIN en Firebase y en la base
 * de datos para cualquier ambiente.
 *
 * USO:
 *   cd apps/erp-monolithic-api
 *   npx ts-node -P apps/api/tsconfig.json scripts/seed-platform-admin.ts \
 *     --email admin@example.com \
 *     --password "S3cur3P@ss" \
 *     --org-id "uuid-del-grupo" \
 *     --company-name "VeloxRent" \
 *     --branch-name "Casa Central"
 *
 * O con variables de entorno equivalentes (útil en CI):
 *   SEED_EMAIL=... SEED_PASSWORD=... SEED_ORG_ID=... \
 *   SEED_COMPANY_NAME=... SEED_BRANCH_NAME=... npx ts-node ...
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
// Config
// ---------------------------------------------------------------------------

interface SeedConfig {
  email: string;
  password: string;
  organizationId: string;
  companyName: string;
  branchName: string;
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
  const companyName = get('--company-name', 'SEED_COMPANY_NAME');
  const branchName = get('--branch-name', 'SEED_BRANCH_NAME');

  const missing: string[] = [];
  if (!email) missing.push('--email / SEED_EMAIL');
  if (!password) missing.push('--password / SEED_PASSWORD');
  if (!companyName) missing.push('--company-name / SEED_COMPANY_NAME');
  if (!branchName) missing.push('--branch-name / SEED_BRANCH_NAME');

  if (missing.length) {
    console.error('Faltan parámetros requeridos:\n  ' + missing.join('\n  '));
    process.exit(1);
  }

  return {
    email: email!,
    password: password!,
    organizationId,
    companyName: companyName!,
    branchName: branchName!,
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
  console.log(`company        : ${config.companyName}`);
  console.log(`branch         : ${config.branchName}`);
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

    // 3b. Crear en transacción: Company → Branch → UserProfile → UserCompanyAssignment
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          id: randomUUID(),
          organizationId: config.organizationId,
          name: config.companyName,
        },
      });
      console.log(`DB: Company creada (id=${company.id})`);

      const branch = await tx.branch.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          name: config.branchName,
        },
      });
      console.log(`DB: Branch creada (id=${branch.id})`);

      const profile = await tx.userProfile.create({
        data: {
          id: randomUUID(),
          organizationId: config.organizationId,
          firebaseUid,
          requiresPasswordChange: false,
        },
      });
      console.log(`DB: UserProfile creado (id=${profile.id})`);

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
      console.log(`DB: UserCompanyAssignment creado (id=${assignment.id})`);
    });

    console.log('\n✓ Seed completado exitosamente.');
    console.log(`\nCredenciales:`);
    console.log(`  Email    : ${config.email}`);
    console.log(`  Password : (la que ingresaste)`);
    console.log(`  Org ID   : ${config.organizationId}`);
  } finally {
    await prisma.$disconnect();
    await admin.app().delete();
  }
}

main().catch((err) => {
  console.error('\n✗ Error en seed:', err);
  process.exit(1);
});
