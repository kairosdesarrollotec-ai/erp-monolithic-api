import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeactivateAssignmentHandler } from './deactivate-assignment.handler';
import { DeactivateAssignmentCommand } from './deactivate-assignment.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { testRole } from '../../../users/testing/role-fixtures';

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(opts: {
  role?: WorkerRole;
  forbidden?: boolean;
  deactivated?: { firebaseUid: string; roleId: string } | null;
  administratorIds?: string[];
} = {}) {
  const {
    role = 'ADMINISTRACION',
    forbidden = false,
    deactivated = { firebaseUid: 'uid-target', roleId: 'role-FRONT_OFFICE' },
    administratorIds = ['assign-admin-1', 'assign-admin-2'],
  } = opts;

  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const adminAuthorization: jest.Mocked<AdminMatrixAuthorizationService> = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (role !== 'ADMINISTRACION') throw new ForbiddenException();
    }),
  } as any;

  const adminUsers: jest.Mocked<AdminUserRepositoryPort> = {
    listAssignmentsByOrganization: jest.fn(),
    findCompanyBranchOwnership: jest.fn(),
    companyBelongsToOrganization: jest.fn(),
    createOrReactivateAssignment: jest.fn(),
    deactivateAssignment: jest.fn().mockResolvedValue(deactivated),
    listEffectiveAssignments: jest.fn(),
    listCompaniesWithBranches: jest.fn(),
  };

  const administratorGuard = {
    administratorAssignmentIds: jest.fn().mockResolvedValue(administratorIds),
  } as unknown as jest.Mocked<AdministratorGuardService>;

  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
    recordIncidentEvent: jest.fn(),
    recordRecruitmentEvent: jest.fn(),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  const handler = new DeactivateAssignmentHandler(
    workContext,
    adminAuthorization,
    adminUsers,
    administratorGuard,
    audit,
    transactionManager,
  );
  return { handler, workContext, adminAuthorization, adminUsers, administratorGuard, audit, transactionManager };
}

function buildCommand(overrides: Partial<DeactivateAssignmentCommand> = {}) {
  return new DeactivateAssignmentCommand(
    overrides.actorFirebaseUid ?? 'uid-admin',
    overrides.actorCompanyId ?? 'company-1',
    overrides.actorBranchId ?? 'branch-1',
    overrides.assignmentId ?? 'assign-1',
  );
}

describe('DeactivateAssignmentHandler', () => {
  it('desactiva la asignacion y registra la auditoria administrativa dentro de la misma transaccion Serializable', async () => {
    const { handler, adminUsers, audit, transactionManager, adminAuthorization } = buildDeps();

    await handler.execute(buildCommand());

    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith(
      'org-1',
      'role-ADMINISTRACION',
      'MANAGE_USERS',
      { companyId: 'company-1', branchId: 'branch-1' },
    );
    expect(transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(adminUsers.deactivateAssignment).toHaveBeenCalledWith('assign-1', 'org-1', FAKE_TX);
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'uid-admin',
        targetFirebaseUid: 'uid-target',
        action: 'USER_ASSIGNMENT_DEACTIVATED',
        changes: { assignmentId: 'assign-1' },
      }),
      FAKE_TX,
    );
  });

  it('rechaza cuando el rol autorizado no tiene ADMIN.MANAGE_USERS', async () => {
    const { handler, adminUsers } = buildDeps({ role: 'FRONT_OFFICE' });

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.deactivateAssignment).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const { handler } = buildDeps({ forbidden: true });

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 404 si la asignacion no existe o no pertenece a la organizacion del admin (IDOR)', async () => {
    const { handler, audit } = buildDeps({ deactivated: null });

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('rechaza con 409 si la asignacion es la UNICA con permisos de administracion vigente (ultimo administrador por permisos)', async () => {
    const { handler, administratorGuard, adminUsers, audit } = buildDeps({ administratorIds: ['assign-1'] });

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ConflictException);
    expect(administratorGuard.administratorAssignmentIds).toHaveBeenCalledWith('org-1', FAKE_TX);
    expect(adminUsers.deactivateAssignment).not.toHaveBeenCalled();
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('permite dar de baja una asignacion administradora si quedan otras administradoras vigentes', async () => {
    const { handler, audit } = buildDeps({ administratorIds: ['assign-1', 'assign-2'] });

    await handler.execute(buildCommand());

    expect(audit.recordAdminEvent).toHaveBeenCalled();
  });

  it('permite dar de baja una asignacion que no es administradora aunque el unico administrador sea otro', async () => {
    const { handler, audit } = buildDeps({ administratorIds: ['assign-admin-only'] });

    await handler.execute(buildCommand());

    expect(audit.recordAdminEvent).toHaveBeenCalled();
  });
});
