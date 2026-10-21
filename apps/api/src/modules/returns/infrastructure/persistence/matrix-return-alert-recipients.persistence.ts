import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/persistence/prisma.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { ReturnAlertRecipientScope, ReturnAlertRecipientsPort } from '../../application/ports/return-alert-recipients.port';
import { RETURN_ALERT_PERMISSION } from '../../domain/return-dashboard-alerts';

@Injectable()
export class MatrixReturnAlertRecipientsPersistence extends ReturnAlertRecipientsPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: MatrixAuthorizationService,
  ) {
    super();
  }

  async rolesWithAlertPermission(scope: ReturnAlertRecipientScope): Promise<WorkerRole[]> {
    const roles = await this.prisma.role.findMany({
      where: { organizationId: scope.organizationId, key: { not: null } },
      select: { id: true, key: true },
      orderBy: { key: 'asc' },
    });
    const allowed: WorkerRole[] = [];
    for (const role of roles) {
      const ok = await this.matrix.isAllowed(
        scope.organizationId,
        role.id,
        RETURN_ALERT_PERMISSION.module,
        RETURN_ALERT_PERMISSION.action,
        { companyId: scope.operatingCompanyId, branchId: scope.branchId },
      );
      if (ok) allowed.push(role.key as WorkerRole);
    }
    return allowed;
  }
}
