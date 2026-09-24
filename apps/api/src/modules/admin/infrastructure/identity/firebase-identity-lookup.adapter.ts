import { Injectable } from '@nestjs/common';
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
