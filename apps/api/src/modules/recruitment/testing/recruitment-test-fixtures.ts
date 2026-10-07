import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { assertRecruitmentRoleAllowed, RecruitmentAction } from '../application/policies/recruitment-role-policy';
import { roleKeyOfTestRoleId, testRole } from '../../users/testing/role-fixtures';
import { TransactionManagerPort } from '../../../common/application/ports/transaction-manager.port';
import { ClockPort } from '../../../common/application/ports/clock.port';

export const ORG_ID = 'org-rec-1';
export const COMPANY_ID = 'company-rec-1';
export const BRANCH_ID = 'branch-rec-1';
export const RECRUITMENT_SCOPE = {
  organizationId: ORG_ID,
  operatingCompanyId: COMPANY_ID,
  branchId: BRANCH_ID,
};

export function buildWorkContext(role: WorkerRole | 'forbidden' = 'RRHH'): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException('Asignación de usuario no vigente.'))
        : jest.fn().mockResolvedValue({
            organizationId: ORG_ID,
            companyId: COMPANY_ID,
            branchId: BRANCH_ID,
            ...testRole(role),
          }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

export function buildMatrixAuth(): jest.Mocked<MatrixAuthorizationService> {
  return {
    isAllowed: jest.fn().mockImplementation(async (_orgId: string, role: string, module: string, action: string) => {
      if (module === 'RECRUITMENT') {
        try {
          assertRecruitmentRoleAllowed(roleKeyOfTestRoleId(role), action as RecruitmentAction);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }),
    assertAllowed: jest.fn().mockImplementation(async (_orgId: string, role: string, module: string, action: string) => {
      if (module === 'RECRUITMENT') {
        assertRecruitmentRoleAllowed(roleKeyOfTestRoleId(role), action as RecruitmentAction);
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;
}

export function buildTransactionManager(): jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient } {
  const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;
  return {
    tx,
    run: jest.fn().mockImplementation(async (work: (t: Prisma.TransactionClient) => Promise<unknown>) => work(tx)),
  } as unknown as jest.Mocked<TransactionManagerPort> & { tx: Prisma.TransactionClient };
}

export class FixedClock extends ClockPort {
  constructor(private instant: Date = new Date('2026-10-07T12:00:00Z')) {
    super();
  }
  now(): Date {
    return new Date(this.instant.getTime());
  }
  set(instant: Date): void {
    this.instant = instant;
  }
}
