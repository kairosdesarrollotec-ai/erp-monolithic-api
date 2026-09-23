import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeactivateAssignmentHandler } from './deactivate-assignment.handler';
import { DeactivateAssignmentCommand } from './deactivate-assignment.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import type { WorkerRole } from '../../../users/domain/worker-role';

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(opts: {
  role?: WorkerRole;
  forbidden?: boolean;
  deactivated?: { firebaseUid: string } | null;
} = {}) {
  const { role = 'ADMINISTRACION', forbidden = false, deactivated = { firebaseUid: 'uid-target' } } = opts;

  const workContext = {
    authorize: forbidden
      ? jest.fn().mockRejectedValue(new ForbiddenException())
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const adminUsers: jest.Mocked<AdminUserRepositoryPort> = {
    listAssignmentsByOrganization: jest.fn(),
    findCompanyBranchOwnership: jest.fn(),
    createOrReactivateAssignment: jest.fn(),
    deactivateAssignment: jest.fn().mockResolvedValue(deactivated),
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

  return { workContext, adminUsers, audit, transactionManager };
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
  it('desactiva la asignacion y registra la auditoria administrativa dentro de la misma transaccion', async () => {
    const { workContext, adminUsers, audit, transactionManager } = buildDeps();
    const handler = new DeactivateAssignmentHandler(workContext, adminUsers, audit, transactionManager);

    await handler.execute(buildCommand());

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

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const { workContext, adminUsers, audit, transactionManager } = buildDeps({ role: 'FRONT_OFFICE' });
    const handler = new DeactivateAssignmentHandler(workContext, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.deactivateAssignment).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const { workContext, adminUsers, audit, transactionManager } = buildDeps({ forbidden: true });
    const handler = new DeactivateAssignmentHandler(workContext, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 404 si la asignacion no existe o no pertenece a la organizacion del admin (IDOR)', async () => {
    const { workContext, adminUsers, audit, transactionManager } = buildDeps({ deactivated: null });
    const handler = new DeactivateAssignmentHandler(workContext, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });
});
