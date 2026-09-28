import { ConflictException, Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { IdentityLookupPort } from '../../application/ports/identity-lookup.port';

@Injectable()
export class FirebaseIdentityLookupAdapter implements IdentityLookupPort {
  async findUidByEmail(email: string): Promise<string | null> {
    initFirebaseAdmin();
    try {
      const user = await getAuth().getUserByEmail(email);
      return user.uid;
    } catch {
      return null;
    }
  }

  async provisionUser(email: string, password: string): Promise<{ uid: string }> {
    initFirebaseAdmin();
    const auth = getAuth();
    try {
      const created = await auth.createUser({ email, emailVerified: true, password });
      return { uid: created.uid };
    } catch (err: unknown) {
      const code = (err as { errorInfo?: { code?: string } }).errorInfo?.code;
      if (code === 'auth/email-already-exists') {
        throw new ConflictException({
          code: 'USER_ALREADY_EXISTS_IN_IDENTITY_PROVIDER',
          detail: 'Ya existe una cuenta de Firebase Authentication con ese correo.',
        });
      }
      throw err;
    }
  }

  async findEmailsByUids(uids: string[]): Promise<Record<string, string | null>> {
    if (uids.length === 0) return {};
    initFirebaseAdmin();
    const result: Record<string, string | null> = {};
    await Promise.all(
      uids.map(async (uid) => {
        try {
          const user = await getAuth().getUser(uid);
          result[uid] = user.email ?? null;
        } catch {
          result[uid] = null;
        }
      }),
    );
    return result;
  }
}
