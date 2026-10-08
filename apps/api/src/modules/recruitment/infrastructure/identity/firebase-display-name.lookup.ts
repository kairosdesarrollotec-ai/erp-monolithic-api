import { Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';

const FIREBASE_GET_USERS_BATCH = 100;

/**
 * Resuelve el nombre visible de usuarios en Firebase Authentication.
 * Solo devuelve un nombre: `displayName` y, si la cuenta no lo tiene (las cuentas
 * provisionadas por ADM-01 nacen sin el), la parte local del correo. El correo
 * completo nunca sale de este adaptador.
 */
@Injectable()
export class FirebaseDisplayNameLookup {
  async findDisplayNames(uids: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const uid of uids) result[uid] = null;
    if (uids.length === 0) return result;
    initFirebaseAdmin();
    for (let i = 0; i < uids.length; i += FIREBASE_GET_USERS_BATCH) {
      const batch = uids.slice(i, i + FIREBASE_GET_USERS_BATCH);
      try {
        const found = await getAuth().getUsers(batch.map((uid) => ({ uid })));
        for (const user of found.users) {
          const display = user.displayName?.trim();
          const local = user.email?.split('@')[0]?.trim();
          result[user.uid] = display || local || null;
        }
      } catch {
        // Un lote fallido deja esos usuarios sin nombre en vez de romper el buscador.
      }
    }
    return result;
  }
}
