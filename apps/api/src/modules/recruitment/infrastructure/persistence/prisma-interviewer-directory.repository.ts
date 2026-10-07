import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  InterviewerCandidateAssignee,
  InterviewerDirectoryPort,
} from '../../application/ports/interviewer-directory.port';
import { FirebaseDisplayNameLookup } from '../identity/firebase-display-name.lookup';

@Injectable()
export class PrismaInterviewerDirectoryRepository implements InterviewerDirectoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly names: FirebaseDisplayNameLookup,
  ) {}

  async listActiveAssignees(
    scope: { organizationId: string; operatingCompanyId: string },
    now: Date,
  ): Promise<InterviewerCandidateAssignee[]> {
    const rows = await this.prisma.userCompanyAssignment.findMany({
      where: {
        organizationId: scope.organizationId,
        companyId: scope.operatingCompanyId,
        active: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        roleRecord: { active: true },
      },
      select: { firebaseUid: true, roleId: true },
    });
    return rows;
  }

  findDisplayNames(uids: string[]): Promise<Record<string, string | null>> {
    return this.names.findDisplayNames(uids);
  }
}
