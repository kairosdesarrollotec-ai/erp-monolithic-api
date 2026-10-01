import { RecipientContact } from '../../domain/external-notification';

export abstract class RecipientContactLookupPort {
  abstract lookupContact(
    recipientFirebaseUid: string,
    organizationId: string,
  ): Promise<RecipientContact | null>;
}
