import { ForbiddenException } from '@nestjs/common';
import { CreateRoleHandler } from './create-role.handler';
import { CreateRoleCommand } from './create-role.command';
import { RenameRoleHandler } from './rename-role.handler';
import { RenameRoleCommand } from './rename-role.command';
import { DeactivateRoleHandler } from './deactivate-role.handler';
import { DeactivateRoleCommand } from './deactivate-role.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { RoleRepositoryPort, RoleRecord } from '../ports/role-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import {
  LastAdministratorRoleError,
  RoleHasActiveAssignmentsError,
  RoleNameInvalidError,
  RoleNameTakenError,
  RoleNotEditableError,
  RoleNotFoundError,
  RoleVersionConflictError,
} from '../../domain/role-errors';
import { testRole } from '../../../users/testing/role-fixtures';

const FAKE_TX = { __fakeTx: true } as any;

function role(overrides: Partial<RoleRecord> = {}): RoleRecord {
  return { id: 'role-x', organizationId: 'org-1', key: null, name: 'Supervisor', isSystem: false, active: true, version: 1, ...overrides };
}

function buildCommon(allowed = true) {
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole('ADMINISTRACION') }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
  const adminAuthorization = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenException();
    }),
  } as unknown as jest.Mocked<AdminMatrixAuthorizationService>;
  const audit = { recordAdminEvent: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditEventRepositoryPort>;
  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn().mockImplementation(async (work: any) => work(FAKE_TX)),
  };
  return { workContext, adminAuthorization, audit, transactionManager };
}

function buildRoles(): jest.Mocked<RoleRepositoryPort> {
  return {
    listByOrganization: jest.fn(),
    findById: jest.fn(),
    listActive: jest.fn(),
    create: jest.fn(),
    rename: jest.fn(),
    deactivate: jest.fn(),
    countActiveAssignments: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<RoleRepositoryPort>;
}

describe('CreateRoleHandler', () => {
  function build(allowed = true) {
    const common = buildCommon(allowed);
    const roles = buildRoles();
    roles.create.mockResolvedValue(role({ id: 'role-new', name: 'Supervisor' }));
    const handler = new CreateRoleHandler(common.workContext, common.adminAuthorization, roles, common.audit, common.transactionManager);
    return { ...common, roles, handler };
  }

  it('crea el rol (con el nombre recortado), audita en la misma tx y devuelve assignmentCount 0', async () => {
    const { handler, roles, audit, adminAuthorization } = build();

    const result = await handler.execute(new CreateRoleCommand('uid-admin', 'company-1', 'branch-1', '  Supervisor  '));

    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith('org-1', 'role-ADMINISTRACION', 'MANAGE_PERMISSIONS', { companyId: 'company-1', branchId: 'branch-1' });
    expect(roles.create).toHaveBeenCalledWith({ organizationId: 'org-1', name: 'Supervisor' }, FAKE_TX);
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_CREATED', entityType: 'role', entityId: 'role-new' }),
      FAKE_TX,
    );
    expect(result).toMatchObject({ id: 'role-new', assignmentCount: 0, version: 1 });
  });

  it.each(['', '   ', 'x'.repeat(61)])('rechaza el nombre invalido %j con 400 ROLE_NAME_INVALID sin abrir tx', async (name) => {
    const { handler, transactionManager } = build();

    await expect(handler.execute(new CreateRoleCommand('uid-admin', 'company-1', 'branch-1', name))).rejects.toBeInstanceOf(RoleNameInvalidError);
    expect(transactionManager.run).not.toHaveBeenCalled();
  });

  it('propaga 409 ROLE_NAME_TAKEN del repositorio y no audita', async () => {
    const { handler, roles, audit } = build();
    roles.create.mockRejectedValue(new RoleNameTakenError('Supervisor'));

    await expect(handler.execute(new CreateRoleCommand('uid-admin', 'company-1', 'branch-1', 'Supervisor'))).rejects.toBeInstanceOf(RoleNameTakenError);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('403 sin ADMIN.MANAGE_PERMISSIONS', async () => {
    const { handler, roles } = build(false);

    await expect(handler.execute(new CreateRoleCommand('uid-admin', 'company-1', 'branch-1', 'Supervisor'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(roles.create).not.toHaveBeenCalled();
  });
});

describe('RenameRoleHandler', () => {
  function build(existing: RoleRecord | null = role({ version: 2 })) {
    const common = buildCommon();
    const roles = buildRoles();
    roles.findById.mockResolvedValue(existing);
    roles.rename.mockImplementation(async (input) => role({ id: input.id, name: input.name, version: input.expectedVersion + 1 }));
    roles.countActiveAssignments.mockResolvedValue(3);
    const handler = new RenameRoleHandler(common.workContext, common.adminAuthorization, roles, common.audit, common.transactionManager);
    return { ...common, roles, handler };
  }
  const cmd = (version = 2, name = 'Jefe de Turno', id = 'role-x') => new RenameRoleCommand(id, 'uid-admin', 'company-1', 'branch-1', version, name);

  it('renombra con control optimista, audita nombre anterior/nuevo y devuelve la version nueva con su assignmentCount', async () => {
    const { handler, roles, audit } = build();

    const result = await handler.execute(cmd());

    expect(roles.rename).toHaveBeenCalledWith({ id: 'role-x', organizationId: 'org-1', expectedVersion: 2, name: 'Jefe de Turno' }, FAKE_TX);
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_RENAMED', entityId: 'role-x', changes: expect.objectContaining({ previousName: 'Supervisor', newName: 'Jefe de Turno', version: 3 }) }),
      FAKE_TX,
    );
    expect(result).toMatchObject({ name: 'Jefe de Turno', version: 3, assignmentCount: 3 });
  });

  it('404 si el rol no existe o es de otra organizacion (IDOR)', async () => {
    const { handler, roles } = build(null);

    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleNotFoundError);
    expect(roles.findById).toHaveBeenCalledWith('role-x', 'org-1', FAKE_TX);
    expect(roles.rename).not.toHaveBeenCalled();
  });

  it('403 ROLE_NOT_EDITABLE para PLATFORM_ADMIN', async () => {
    const { handler, roles } = build(role({ key: 'PLATFORM_ADMIN', isSystem: true }));

    await expect(handler.execute(cmd(1))).rejects.toBeInstanceOf(RoleNotEditableError);
    expect(roles.rename).not.toHaveBeenCalled();
  });

  it('un rol de sistema distinto de PLATFORM_ADMIN SI se puede renombrar (la key no cambia)', async () => {
    const { handler, roles } = build(role({ key: 'GERENCIA', isSystem: true, version: 1 }));

    await handler.execute(cmd(1));

    expect(roles.rename).toHaveBeenCalled();
  });

  it('412 VERSION_CONFLICT si If-Match no coincide con la version leida', async () => {
    const { handler, roles } = build(role({ version: 5 }));

    await expect(handler.execute(cmd(2))).rejects.toBeInstanceOf(RoleVersionConflictError);
    expect(roles.rename).not.toHaveBeenCalled();
  });

  it('412 VERSION_CONFLICT si el repositorio devuelve null (carrera entre lectura y escritura)', async () => {
    const { handler, roles, audit } = build();
    roles.rename.mockResolvedValue(null);

    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleVersionConflictError);
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('400 ROLE_NAME_INVALID sin abrir tx', async () => {
    const { handler, transactionManager } = build();

    await expect(handler.execute(cmd(2, '   '))).rejects.toBeInstanceOf(RoleNameInvalidError);
    expect(transactionManager.run).not.toHaveBeenCalled();
  });
});

describe('DeactivateRoleHandler', () => {
  function build(existing: RoleRecord | null = role({ version: 2 }), assignments = 0) {
    const common = buildCommon();
    const roles = buildRoles();
    roles.findById.mockResolvedValue(existing);
    roles.countActiveAssignments.mockResolvedValue(assignments);
    roles.deactivate.mockImplementation(async (input) => role({ id: input.id, active: false, version: input.expectedVersion + 1 }));
    const administratorGuard = {
      assertRoleDeactivationKeepsAnAdministrator: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AdministratorGuardService>;
    const handler = new DeactivateRoleHandler(common.workContext, common.adminAuthorization, roles, administratorGuard, common.audit, common.transactionManager);
    return { ...common, roles, administratorGuard, handler };
  }
  const cmd = (version = 2) => new DeactivateRoleCommand('role-x', 'uid-admin', 'company-1', 'branch-1', version);

  it('desactiva (nunca borra) en tx Serializable, audita y devuelve assignmentCount 0', async () => {
    const { handler, roles, audit, transactionManager, administratorGuard } = build();

    const result = await handler.execute(cmd());

    expect(transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(administratorGuard.assertRoleDeactivationKeepsAnAdministrator).toHaveBeenCalledWith('org-1', 'role-x', FAKE_TX);
    expect(roles.deactivate).toHaveBeenCalledWith({ id: 'role-x', organizationId: 'org-1', expectedVersion: 2 }, FAKE_TX);
    expect(audit.recordAdminEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_DEACTIVATED', entityId: 'role-x' }), FAKE_TX);
    expect(result).toMatchObject({ active: false, version: 3, assignmentCount: 0 });
  });

  it('404 si no existe en la organizacion', async () => {
    const { handler } = build(null);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleNotFoundError);
  });

  it('403 ROLE_NOT_EDITABLE para PLATFORM_ADMIN', async () => {
    const { handler } = build(role({ key: 'PLATFORM_ADMIN', isSystem: true, version: 2 }));
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleNotEditableError);
  });

  it('412 si la version no coincide', async () => {
    const { handler, roles } = build(role({ version: 9 }));
    await expect(handler.execute(cmd(2))).rejects.toBeInstanceOf(RoleVersionConflictError);
    expect(roles.deactivate).not.toHaveBeenCalled();
  });

  it('409 ROLE_HAS_ACTIVE_ASSIGNMENTS si hay asignaciones activas con el rol (no se desactiva ni se audita)', async () => {
    const { handler, roles, audit } = build(role({ version: 2 }), 2);

    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleHasActiveAssignmentsError);
    expect(roles.deactivate).not.toHaveBeenCalled();
    expect(audit.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('409 LAST_ADMINISTRATOR_ROLE si el guard por permisos lo rechaza', async () => {
    const { handler, administratorGuard, roles } = build();
    administratorGuard.assertRoleDeactivationKeepsAnAdministrator.mockRejectedValue(new LastAdministratorRoleError());

    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(LastAdministratorRoleError);
    expect(roles.deactivate).not.toHaveBeenCalled();
  });

  it('412 si el repositorio devuelve null (carrera)', async () => {
    const { handler, roles } = build();
    roles.deactivate.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toBeInstanceOf(RoleVersionConflictError);
  });
});
