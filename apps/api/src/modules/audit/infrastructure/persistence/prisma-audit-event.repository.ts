import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import {
  AuditEventRepositoryPort,
  RecordLoginAttemptInput,
  RecordWorkContextSelectionInput,
} from '../../application/ports/audit-event-repository.port';

@Injectable()
export class PrismaAuditEventRepository implements AuditEventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async recordLoginAttempt(input: RecordLoginAttemptInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId ?? 'UNKNOWN',
        actorUserId: input.actorUserId,
        entityType: 'auth',
        entityId: input.email,
        action: 'LOGIN_ATTEMPT',
        changes: { outcome: input.outcome, reason: input.reason },
      },
    });
  }

  async recordWorkContextSelection(input: RecordWorkContextSelectionInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.firebaseUid,
        entityType: 'work_context',
        entityId: input.firebaseUid,
        action: 'WORK_CONTEXT_SELECTED',
        changes: { companyId: input.companyId, branchId: input.branchId },
      },
    });
  }
}
