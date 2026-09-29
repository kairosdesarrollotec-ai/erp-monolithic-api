import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AssignUserToCompanyHandler } from './assign-user-to-company.handler';
import { AssignUserToCompanyCommand } from './assign-user-to-company.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { UserProfileRepositoryPort } from '../../../users/application/ports/user-profile-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { EmailNotificationPort } from '../ports/email-notification.port';
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
    listCompaniesWithBranches: jest.fn(),
  };

  const identity: jest.Mocked<IdentityLookupPort> = {
    findUidByEmail: jest.fn().mockResolvedValue(targetUid),
    provisionUser: jest.fn().mockResolvedValue({ uid: 'uid-new' }),
    findEmailsByUids: jest.fn(),
  };

  const userProfiles: jest.Mocked<UserProfileRepositoryPort> = {
    findByFirebaseUid: jest.fn(),
    createProfile: jest.fn().mockResolvedValue(undefined),
    completeActivation: jest.fn(),
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

  const emailNotification: jest.Mocked<EmailNotificationPort> = {
    sendWelcomeUser: jest.fn().mockResolvedValue(undefined),
  };

  return { workContext, adminAuthorization, adminUsers, identity, userProfiles, audit, transactionManager, emailNotification };
}

function buildHandler(deps: ReturnType<typeof buildDeps>) {
  return new AssignUserToCompanyHandler(
    deps.workContext,
    deps.adminAuthorization,
    deps.adminUsers,
    deps.identity,
    deps.userProfiles,
    deps.audit,
    deps.transactionManager,
    deps.emailNotification,
  );
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
    'initialPassword' in overrides ? overrides.initialPassword : 'Temporal@123',
  );
}

describe('AssignUserToCompanyHandler', () => {
  it('reutiliza uid existente, crea o reactiva la asignacion y registra auditoria en la misma transaccion', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

    const result = await handler.execute(buildCommand());

    expect(deps.identity.findUidByEmail).toHaveBeenCalledWith('nuevo@veloxrent.pe');
    expect(deps.identity.provisionUser).not.toHaveBeenCalled();
    expect(deps.userProfiles.createProfile).not.toHaveBeenCalled();
    expect(deps.adminUsers.createOrReactivateAssignment).toHaveBeenCalledWith(
      {
        organizationId: 'org-1',
        firebaseUid: 'uid-target',
        companyId: 'company-2',
        branchId: 'branch-2',
        role: 'FRONT_OFFICE',
      },
      FAKE_TX,
    );
    expect(deps.audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'uid-admin',
        targetFirebaseUid: 'uid-target',
        action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED',
      }),
      FAKE_TX,
    );
    expect(deps.emailNotification.sendWelcomeUser).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'assign-1' });
  });

  it('provisionUser crea cuenta Firebase y UserProfile cuando el correo no existe, exige cambio de contraseña', async () => {
    const deps = buildDeps({ targetUid: null });
    const handler = buildHandler(deps);

    const result = await handler.execute(buildCommand());

    expect(deps.identity.provisionUser).toHaveBeenCalledWith('nuevo@veloxrent.pe', 'Temporal@123');
    expect(deps.userProfiles.createProfile).toHaveBeenCalledWith({
      firebaseUid: 'uid-new',
      organizationId: 'org-1',
      requiresPasswordChange: true,
    });
    expect(deps.adminUsers.createOrReactivateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'uid-new' }),
      FAKE_TX,
    );
    expect(deps.audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_ASSIGNMENT_CREATED_OR_REACTIVATED' }),
      FAKE_TX,
    );
    // email fire-and-forget: se llama pero no esperamos su resolución
    await new Promise(process.nextTick); // deja que la promesa void se resuelva
    expect(deps.emailNotification.sendWelcomeUser).toHaveBeenCalledWith('nuevo@veloxrent.pe', 'Temporal@123');
    expect(result).toEqual({ id: 'assign-1' });
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const handler = buildHandler(deps);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
    expect(deps.adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const deps = buildDeps({ forbidden: true });
    const handler = buildHandler(deps);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza con ConflictException si provisionUser falla porque el correo ya existe en Firebase (race condition)', async () => {
    const deps = buildDeps({ targetUid: null });
    deps.identity.provisionUser.mockRejectedValue(
      new ConflictException({ code: 'USER_ALREADY_EXISTS_IN_IDENTITY_PROVIDER' }),
    );
    const handler = buildHandler(deps);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(ConflictException);
    expect(deps.adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
  });

  it('rechaza con COMPANY_BRANCH_NOT_IN_ORGANIZATION si la empresa/sede destino no pertenece a la organizacion (IDOR)', async () => {
    const deps = buildDeps({ ownership: null });
    const handler = buildHandler(deps);

    await expect(handler.execute(buildCommand())).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
    expect(deps.audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('reutiliza uid existente sin exigir initialPassword (correo ya existe, el campo se ignora)', async () => {
    const deps = buildDeps();
    const handler = buildHandler(deps);

    const result = await handler.execute(buildCommand({ initialPassword: undefined }));

    expect(deps.identity.provisionUser).not.toHaveBeenCalled();
    expect(deps.adminUsers.createOrReactivateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'uid-target' }),
      FAKE_TX,
    );
    expect(result).toEqual({ id: 'assign-1' });
  });

  it('rechaza con INITIAL_PASSWORD_REQUIRED si el correo es nuevo y no se envio initialPassword', async () => {
    const deps = buildDeps({ targetUid: null });
    const handler = buildHandler(deps);

    await expect(handler.execute(buildCommand({ initialPassword: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deps.identity.provisionUser).not.toHaveBeenCalled();
    expect(deps.adminUsers.createOrReactivateAssignment).not.toHaveBeenCalled();
  });
});
