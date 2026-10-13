import { Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { UserAccountEmailPort } from '../../application/ports/user-account-email.port';

/** Adaptador best-effort: nunca debe romper la operación si Firebase no responde. */
@Injectable()
export class FirebaseUserAccountEmailAdapter implements UserAccountEmailPort {
  async findEmail(firebaseUid: string): Promise<string | null> {
    try {
      initFirebaseAdmin();
      const user = await getAuth().getUser(firebaseUid);
      return user.email?.trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }
}
