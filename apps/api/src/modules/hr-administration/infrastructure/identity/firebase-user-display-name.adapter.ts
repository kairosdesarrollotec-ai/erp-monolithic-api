import { Injectable } from '@nestjs/common';
import { UserDisplayNamePort } from '../../application/ports/user-display-name.port';
import { FirebaseDisplayNameLookup } from '../../../recruitment/infrastructure/identity/firebase-display-name.lookup';

/** Adaptador best-effort: nunca debe romper la operacion de negocio si Firebase no responde. */
@Injectable()
export class FirebaseUserDisplayNameAdapter implements UserDisplayNamePort {
  constructor(private readonly lookup: FirebaseDisplayNameLookup) {}

  async findDisplayName(firebaseUid: string): Promise<string | null> {
    try {
      const names = await this.lookup.findDisplayNames([firebaseUid]);
      return names[firebaseUid] ?? null;
    } catch {
      return null;
    }
  }
}
