import { RecipientContact } from '../../domain/external-notification';

export abstract class RecipientContactLookupPort {
  abstract lookupContact(
    recipientFirebaseUid: string,
  ): Promise<RecipientContact | null>;
}
