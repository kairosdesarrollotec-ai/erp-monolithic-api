import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { AlertRecipientScope, AlertRecipientsPort } from '../../application/ports/alert-recipients.port';
import type { NotificationAction } from '../../application/policies/notification-role-policy';

@Injectable()
export class MatrixAlertRecipientsPersistence extends AlertRecipientsPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: MatrixAuthorizationService,
  ) {
    super();
  }

  async rolesWithPermission(scope: AlertRecipientScope, action: NotificationAction): Promise<WorkerRole[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: scope.organizationId, key: { not: null } },
      select: { id: true, key: true },
      orderBy: { key: 'asc' },
    });
    const allowed: WorkerRole[] = [];
    for (const role of roles) {
      const ok = await this.matrix.isAllowed(scope.organizationId, role.id, 'NOTIFICATIONS', action, {
        companyId: scope.operatingCompanyId,
        branchId: scope.branchId,
      });
      if (ok) allowed.push(role.key as WorkerRole);
    }
    return allowed;
  }
}
