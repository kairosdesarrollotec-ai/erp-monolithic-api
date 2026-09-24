import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssignUserToCompanyHandler } from './assign-user-to-company.handler';
import { AssignUserToCompanyCommand } from './assign-user-to-company.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(opts: {
  role?: WorkerRole;
  forbidden?: boolean;
  targetUid?: string | null;
  ownership?: { companyId: string; branchId: string } | null;
} = {}) {
  const { role = 'ADMINISTRACION', forbidden = false, targetUid = 'uid-target', ownership = { companyId: 'company-2', branchId: 'branch-2' } } = opts;

  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const adminAuthorization: jest.Mocked<AdminMatrixAuthorizationService> = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (role !== 'ADMINISTRACION') throw new ForbiddenException();
    }),
  } as any;

  const adminUsers: jest.Mocked<AdminUserRepositoryPort> = {
    listAssignmentsByOrganization: jest.fn(),
    findCompanyBranchOwnership: jest.fn().mockResolvedValue(ownership),
    createOrReactivateAssignment: jest.fn().mockResolvedValue({ id: 'assign-1' }),
    deactivateAssignment: jest.fn(),
    countActiveByRole: jest.fn(),
  };

  const identity: jest.Mocked<IdentityLookupPort> = {
    findUidByEmail: jest.fn().mockResolvedValue(targetUid),
    findEmailsByUids: jest.fn(),
  };

  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  return { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager };
}

function buildCommand(overrides: Partial<AssignUserToCompanyCommand> = {}) {
  return new AssignUserToCompanyCommand(
    overrides.actorFirebaseUid ?? 'uid-admin',
    overrides.actorCompanyId ?? 'company-1',
    overrides.actorBranchId ?? 'branch-1',
    overrides.targetEmail ?? 'nuevo@veloxrent.pe',
    overrides.targetCompanyId ?? 'company-2',
    overrides.targetBranchId ?? 'branch-2',
    overrides.targetRole ?? 'FRONT_OFFICE',
  );
}

describe('AssignUserToCompanyHandler', () => {
  it('crea o reactiva la asignacion y registra la auditoria administrativa dentro de la misma transaccion', async () => {
    const { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager } = buildDeps();
    const handler = new AssignUserToCompanyHandler(workContext, adminAuthorization, adminUsers, identity, audit, transactionManager);

    const result = await handler.execute(buildCommand());

    expect(identity.findUidByEmail).toHaveBeenCalledWith('nuevo@veloxrent.pe');
    expect(adminUsers.findCompanyBranchOwnership).toHaveBeenCalledWith('org-1', 'company-2', 'branch-2');
    expect(adminUsers.createOrReactivateAssignment).toHaveBeenCalledWith(
      {
        organizationId: 'org-1',
        firebaseUid: 'uid-target',
        companyId: 'company-2',
        branchId: 'branch-2',
        role: 'FRONT_OFFICE',
      },
      FAKE_TX,
    );
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'uid-admin',
        targetFirebaseUid: 'uid-target',
        action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
      }),
      FAKE_TX,
    );
    expect(result).toEqual({ id: 'assign-1' });
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager } = buildDeps({ role: 'FRONT_OFFICE' });
    const handler = new AssignUserToCompanyHandler(workContext, adminAuthorization, adminUsers, identity, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager } = buildDeps({ forbidden: true });
    const handler = new AssignUserToCompanyHandler(workContext, adminAuthorization, adminUsers, identity, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con USER_NOT_FOUND_IN_IDENTITY_PROVIDER si el correo no existe en Firebase', async () => {
    const { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager } = buildDeps({ targetUid: null });
    const handler = new AssignUserToCompanyHandler(workContext, adminAuthorization, adminUsers, identity, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(adminUsers.findCompanyBranchOwnership).not.toHaveBeenCalled();
    expect(adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
  });

  it('rechaza con COMPANY_BRANCH_NOT_IN_ORGANIZATION si la empresa/sede destino no pertenece a la organizacion (IDOR)', async () => {
    const { workContext, adminAuthorization, adminUsers, identity, audit, transactionManager } = buildDeps({ ownership: null });
    const handler = new AssignUserToCompanyHandler(workContext, adminAuthorization, adminUsers, identity, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(BadRequestException);
    expect(adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });
});
