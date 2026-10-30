import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  ReturnBellNotificationInput,
  ReturnBellNotificationPort,
} from '../../application/ports/return-bell-notification.port';

@Injectable()
export class PrismaReturnBellNotificationPersistence extends ReturnBellNotificationPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async notifyRoles(input: ReturnBellNotificationInput): Promise<number> {
    if (input.roles.length === 0) return 0;
    const now = new Date();
    const assignments = await this.prisma.userCompanyAssignment.findMany({
      where: {
        organizationId: input.organizationId,
        companyId: input.operatingCompanyId,
        branchId: input.branchId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        roleRecord: { key: { in: [...input.roles] } },
      },
      select: { firebaseUid: true },
    });
    const uids = [...new Set(assignments.map((a) => a.firebaseUid))];
    if (uids.length === 0) return 0;
    const result = await this.prisma.notificationReadModel.createMany({
      data: uids.map((uid) => ({
        organizationId: input.organizationId,
        companyId: input.operatingCompanyId,
        branchId: input.branchId,
        recipientFirebaseUid: uid,
        notificationType: input.notificationType,
        isEscalated: input.isEscalated ?? true,
        title: input.title,
        deepLink: input.deepLink,
        sourceEventId: `${input.sourceEventPrefix}:${uid}`,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }
}
