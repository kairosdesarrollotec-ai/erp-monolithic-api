import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  UserProfileRepositoryPort,
  UserProfileRecord,
} from '../../application/ports/user-profile-repository.port';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<UserProfileRecord | null> {
    return this.prisma.userProfile.findUnique({ where: { firebaseUid } });
  }

  async completeActivation(firebaseUid: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { firebaseUid },
      data: { requiresPasswordChange: false, mfaEnrolledAt: new Date() },
    });
  }
}
