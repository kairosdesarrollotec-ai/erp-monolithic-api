import { Injectable, Logger } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { initFirebaseAdmin } from '../../../../config/firebase-admin.config';
import { RecipientContact } from '../../domain/external-notification';
import { RecipientContactLookupPort } from '../../application/ports/recipient-contact-lookup.port';

@Injectable()
export class FirebaseRecipientContactLookupAdapter
  implements RecipientContactLookupPort
{
  private readonly logger = new Logger(
    FirebaseRecipientContactLookupAdapter.name,
  );

  // organizationId is received for future per-org contact resolution;
  // Firebase UID lookup is currently org-agnostic.
  async lookupContact(
    recipientFirebaseUid: string,
    _organizationId: string,
  ): Promise<RecipientContact | null> {
    try {
      initFirebaseAdmin();
      const user = await getAuth().getUser(recipientFirebaseUid);

      const rawTokens =
        (user.customClaims?.fcmTokens as unknown) ??
        (user.customClaims?.fcmToken as unknown) ??
        [];
      const pushTokens: string[] = Array.isArray(rawTokens)
        ? (rawTokens.filter((t) => typeof t === 'string') as string[])
        : typeof rawTokens === 'string'
          ? [rawTokens]
          : [];

      return {
        recipientId: user.uid,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        pushTokens,
        displayName: user.displayName ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `Firebase lookup failed for uid ${recipientFirebaseUid.slice(0, 6)}...: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
