import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  CreateProfileInput,
  UserProfileRepositoryPort,
  UserProfileRecord,
} from '../../application/ports/user-profile-repository.port';

@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<UserProfileRecord | null> {
    return this.prisma.userProfile.findUnique({ where: { firebaseUid } });
  }

  async createProfile(input: CreateProfileInput): Promise<void> {
    await this.prisma.userProfile.upsert({
      where: { firebaseUid: input.firebaseUid },
      create: {
        firebaseUid: input.firebaseUid,
        organizationId: input.organizationId,
        requiresPasswordChange: input.requiresPasswordChange ?? true,
        mfaEnrolledAt: null,
      },
      update: {},
    });
  }

  async completeActivation(firebaseUid: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { firebaseUid },
      data: { requiresPasswordChange: false, mfaEnrolledAt: new Date() },
    });
  }
}
