import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeactivateAssignmentHandler } from './deactivate-assignment.handler';
import { DeactivateAssignmentCommand } from './deactivate-assignment.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';

const FAKE_TX = { __fakeTx: true } as any;

function buildDeps(opts: {
  role?: WorkerRole;
  forbidden?: boolean;
  deactivated?: { firebaseUid: string; role: WorkerRole } | null;
  remainingActiveAdmins?: number;
} = {}) {
  const {
    role = 'ADMINISTRACION',
    forbidden = false,
    deactivated = { firebaseUid: 'uid-target', role: 'FRONT_OFFICE' as WorkerRole },
    remainingActiveAdmins = 1,
  } = opts;

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
    findCompanyBranchOwnership: jest.fn(),
    createOrReactivateAssignment: jest.fn(),
    deactivateAssignment: jest.fn().mockResolvedValue(deactivated),
    countActiveByRole: jest.fn().mockResolvedValue(remainingActiveAdmins),
    listCompaniesWithBranches: jest.fn(),
  };

  const audit: jest.Mocked<AuditEventRepositoryPort> = {
    recordLoginAttempt: jest.fn(),
    recordWorkContextSelection: jest.fn(),
    recordReservationEvent: jest.fn(),
    recordInquiryEvent: jest.fn(),
    recordAdminEvent: jest.fn(),
    recordRentalEvent: jest.fn(),
    recordIncidentEvent: jest.fn(),
  };

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn((work: any) => work(FAKE_TX)),
  };

  return { workContext, adminAuthorization, adminUsers, audit, transactionManager };
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
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps();
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

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
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({ role: 'FRONT_OFFICE' });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.deactivateAssignment).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({ forbidden: true });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con 404 si la asignacion no existe o no pertenece a la organizacion del admin (IDOR)', async () => {
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({ deactivated: null });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('rechaza con 409 si la asignacion es ADMINISTRACION y es la unica activa que queda en la organizacion (ultimo administrador)', async () => {
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({
      deactivated: { firebaseUid: 'uid-target', role: 'ADMINISTRACION' },
      remainingActiveAdmins: 0,
    });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ConflictException);
    expect(adminUsers.countActiveByRole).toHaveBeenCalledWith('org-1', 'ADMINISTRACION', FAKE_TX);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('permite dar de baja una asignacion ADMINISTRACION si quedan otras activas en la organizacion', async () => {
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({
      deactivated: { firebaseUid: 'uid-target', role: 'ADMINISTRACION' },
      remainingActiveAdmins: 1,
    });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await handler.execute(buildCommand());

    expect(audit.recordAdminEvent).toHaveBeenCalled();
  });

  it('no cuenta administradores activos si el rol dado de baja no es ADMINISTRACION', async () => {
    const { workContext, adminAuthorization, adminUsers, audit, transactionManager } = buildDeps({
      deactivated: { firebaseUid: 'uid-target', role: 'FRONT_OFFICE' },
    });
    const handler = new DeactivateAssignmentHandler(workContext, adminAuthorization, adminUsers, audit, transactionManager);

    await handler.execute(buildCommand());

    expect(adminUsers.countActiveByRole).not.toHaveBeenCalled();
    expect(audit.recordAdminEvent).toHaveBeenCalled();
  });
});
