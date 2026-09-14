import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';

/**
 * Inicializacion del Admin SDK de Firebase (verificacion de tokens de
 * Firebase Auth / Identity Platform emitidos por el frontend).
 *
 * A que proyecto de Firebase apunta (desarrollo o productivo) se decide
 * unicamente por las variables de entorno FIREBASE_PROJECT_ID /
 * FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (ver .env.example) - nunca
 * hardcodear credenciales aqui.
 */
export function initFirebaseAdmin(): App {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Faltan variables de entorno de Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Ver apps/api/.env.example.',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}
