import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SaveRolePermissionMatrixHandler } from './save-role-permission-matrix.handler';
import { SaveRolePermissionMatrixCommand } from './save-role-permission-matrix.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort, RolePermissionEntry } from '../ports/role-permission-matrix.port';
import { RoleRepositoryPort, RoleRecord } from '../ports/role-repository.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { INCOMPATIBLE_ACTION_PAIRS, PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { WORKER_ROLES, WorkerRole } from '../../../users/domain/worker-role';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import { AdministratorGuardService } from '../services/administrator-guard.service';
import { MatrixScopeService } from '../services/matrix-scope.service';
import { LastAdministratorRoleError } from '../../domain/role-errors';
import { testRole, testRoleId } from '../../../users/testing/role-fixtures';

const FAKE_TX = { __fakeTx: true } as any;
const EDITABLE_KEYS = WORKER_ROLES.filter((key) => key !== 'PLATFORM_ADMIN');

function buildRole(key: WorkerRole | string, overrides: Partial<RoleRecord> = {}): RoleRecord {
  return {
    id: testRoleId(key),
    organizationId: 'org-1',
    key: WORKER_ROLES.includes(key as WorkerRole) ? (key as WorkerRole) : null,
    name: String(key),
    isSystem: WORKER_ROLES.includes(key as WorkerRole),
    active: true,
    version: 1,
    ...overrides,
  };
}

/** Matriz completa para los roles EDITABLES (sin PLATFORM_ADMIN) en false, con overrides. */
function buildCompleteEntries(
  overrides: { roleKey: string; module: RolePermissionEntry['module']; action: string; allowed: boolean }[] = [],
  roleKeys: readonly string[] = EDITABLE_KEYS,
): RolePermissionEntry[] {
  const entries: RolePermissionEntry[] = roleKeys.flatMap((key) =>
    PERMISSION_ACTION_CATALOG.map((descriptor) => ({
      roleId: testRoleId(key),
      module: descriptor.module,
      action: descriptor.action,
      allowed: false,
    })),
  );
  for (const override of overrides) {
    const target = entries.find(
      (e) => e.roleId === testRoleId(override.roleKey) && e.module === override.module && e.action === override.action,
    );
    if (target) target.allowed = override.allowed;
  }
  return entries;
}

function buildDeps(opts: { role?: WorkerRole; activeRoles?: RoleRecord[] } = {}) {
  const { role = 'ADMINISTRACION', activeRoles = WORKER_ROLES.map((key) => buildRole(key)) } = opts;
  const authorization = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as WorkContextAuthorizationService;

  const adminAuthorization = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (role !== 'ADMINISTRACION') throw new ForbiddenException();
    }),
  } as unknown as jest.Mocked<AdminMatrixAuthorizationService>;

  const matrix = {
    getCurrentVersion: jest.fn().mockResolvedValue({ version: 3, scope: { companyId: null, branchId: null }, entries: [] }),
    saveNewVersion: jest.fn().mockImplementation(async (_org, entries, _by, scope) => ({ version: 4, scope, entries })),
  } as unknown as jest.Mocked<RolePermissionMatrixPort>;

  const roles = {
    listActive: jest.fn().mockResolvedValue(activeRoles),
  } as unknown as jest.Mocked<RoleRepositoryPort>;

  const scopes = {
    resolve: jest.fn().mockImplementation(async (_org: string, companyId?: string | null, branchId?: string | null) => ({
      companyId: companyId ?? null,
      branchId: branchId ?? null,
    })),
  } as unknown as jest.Mocked<MatrixScopeService>;

  const administratorGuard = {
    assertMatrixKeepsAnAdministrator: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AdministratorGuardService>;

  const auditRepository = {
    recordAdminEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditEventRepositoryPort>;

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn().mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(FAKE_TX)),
  };

  const handler = new SaveRolePermissionMatrixHandler(
    authorization,
    adminAuthorization,
    matrix,
    roles,
    scopes,
    administratorGuard,
    auditRepository,
    transactionManager,
  );
  return { handler, adminAuthorization, matrix, roles, scopes, administratorGuard, auditRepository, transactionManager };
}

function command(entries: RolePermissionEntry[], scopeCompanyId?: string | null, scopeBranchId?: string | null) {
  return new SaveRolePermissionMatrixCommand('uid-admin', 'company-1', 'branch-1', entries, scopeCompanyId, scopeBranchId);
}

describe('SaveRolePermissionMatrixHandler', () => {
  it('guarda una nueva version en una tx Serializable, audita y devuelve el catalogo', async () => {
    const { handler, matrix, auditRepository, transactionManager, adminAuthorization } = buildDeps();

    const result = await handler.execute(command(buildCompleteEntries()));

    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith('org-1', 'role-ADMINISTRACION', 'MANAGE_PERMISSIONS', {
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(transactionManager.run).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(result.version).toBe(4);
    expect(result.actionCatalog.length).toBe(PERMISSION_ACTION_CATALOG.length);
    expect(matrix.saveNewVersion).toHaveBeenCalledWith(
      'org-1',
      expect.any(Array),
      'uid-admin',
      { companyId: null, branchId: null },
      FAKE_TX,
    );
    expect(auditRepository.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ROLE_PERMISSION_MATRIX_UPDATED',
        changes: { previousVersion: 3, newVersion: 4, scope: { companyId: null, branchId: null } },
      }),
      FAKE_TX,
    );
  });

  it('rechaza cuando el rol autorizado no tiene ADMIN.MANAGE_PERMISSIONS', async () => {
    const { handler, matrix } = buildDeps({ role: 'FRONT_OFFICE' });

    await expect(handler.execute(command(buildCompleteEntries()))).rejects.toBeInstanceOf(ForbiddenException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('PLATFORM_ADMIN no es editable: sus celdas enviadas se ignoran y siempre se guarda todo permitido', async () => {
    const { handler, matrix } = buildDeps();
    const withPlatformAdminFalse = [
      ...buildCompleteEntries(),
      ...buildCompleteEntries([], ['PLATFORM_ADMIN']), // todo false: debe ignorarse
    ];

    await handler.execute(command(withPlatformAdminFalse));

    const saved = matrix.saveNewVersion.mock.calls[0][1];
    const platformAdminEntries = saved.filter((e) => e.roleId === testRoleId('PLATFORM_ADMIN'));
    expect(platformAdminEntries).toHaveLength(PERMISSION_ACTION_CATALOG.length);
    expect(platformAdminEntries.every((e) => e.allowed)).toBe(true);
  });

  it('no exige las celdas de PLATFORM_ADMIN (solo roles activos editables x catalogo)', async () => {
    const { handler, matrix } = buildDeps();

    await handler.execute(command(buildCompleteEntries()));

    expect(matrix.saveNewVersion).toHaveBeenCalledTimes(1);
  });

  it('un rol nuevo creado a mano debe venir completo en la matriz (nace con todo en false)', async () => {
    const custom = buildRole('role-custom', { id: 'role-custom', key: null, isSystem: false, name: 'Supervisor' });
    const { handler, matrix } = buildDeps({ activeRoles: [...WORKER_ROLES.map((key) => buildRole(key)), custom] });

    await expect(handler.execute(command(buildCompleteEntries()))).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();

    const completeWithCustom = [
      ...buildCompleteEntries(),
      ...PERMISSION_ACTION_CATALOG.map((d) => ({ roleId: 'role-custom', module: d.module, action: d.action, allowed: false })),
    ];
    await handler.execute(command(completeWithCustom));
    expect(matrix.saveNewVersion).toHaveBeenCalledTimes(1);
  });

  it('rechaza una matriz incompleta (INCOMPLETE_MATRIX)', async () => {
    const { handler, matrix } = buildDeps();

    await expect(handler.execute(command(buildCompleteEntries().slice(1)))).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('rechaza celdas de un rol inexistente/inactivo o de otra organizacion', async () => {
    const { handler, matrix } = buildDeps();
    const extra: RolePermissionEntry = {
      roleId: 'role-ajeno',
      module: PERMISSION_ACTION_CATALOG[0].module,
      action: PERMISSION_ACTION_CATALOG[0].action,
      allowed: true,
    };

    await expect(handler.execute(command([...buildCompleteEntries(), extra]))).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('rechaza una celda repetida', async () => {
    const { handler, matrix } = buildDeps();
    const entries = buildCompleteEntries();

    await expect(handler.execute(command([...entries, entries[0]]))).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('rechaza combinaciones incompatibles de segregacion de funciones (409 INCOMPATIBLE_PERMISSIONS)', async () => {
    // El negocio no ha definido pares: se inyecta uno de prueba para cubrir el mecanismo.
    INCOMPATIBLE_ACTION_PAIRS.push(['RESERVATION.REGISTER_PAYMENT', 'RESERVATION.CONFIRM']);
    try {
      const { handler, matrix } = buildDeps();
      const conflicting = buildCompleteEntries([
        { roleKey: 'FRONT_OFFICE', module: 'RESERVATION', action: 'REGISTER_PAYMENT', allowed: true },
        { roleKey: 'FRONT_OFFICE', module: 'RESERVATION', action: 'CONFIRM', allowed: true },
      ]);

      await expect(handler.execute(command(conflicting))).rejects.toBeInstanceOf(ConflictException);
      expect(matrix.saveNewVersion).not.toHaveBeenCalled();
    } finally {
      INCOMPATIBLE_ACTION_PAIRS.pop();
    }
  });

  it('sin pares definidos por el negocio, registrar pago y confirmar a la vez (Administracion, Front Office, Gerencia) SI se guarda', async () => {
    expect(INCOMPATIBLE_ACTION_PAIRS).toHaveLength(0);
    const { handler, matrix } = buildDeps();
    const overrides = (['ADMINISTRACION', 'FRONT_OFFICE', 'GERENCIA'] as const).flatMap((roleKey) => [
      { roleKey, module: 'RESERVATION' as const, action: 'REGISTER_PAYMENT', allowed: true },
      { roleKey, module: 'RESERVATION' as const, action: 'CONFIRM', allowed: true },
    ]);

    await handler.execute(command(buildCompleteEntries(overrides)));

    expect(matrix.saveNewVersion).toHaveBeenCalledTimes(1);
  });

  it('propaga 409 LAST_ADMINISTRATOR_ROLE del guard sin guardar ni auditar', async () => {
    const { handler, administratorGuard, matrix, auditRepository } = buildDeps();
    administratorGuard.assertMatrixKeepsAnAdministrator.mockRejectedValue(new LastAdministratorRoleError());

    await expect(handler.execute(command(buildCompleteEntries()))).rejects.toBeInstanceOf(LastAdministratorRoleError);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
    expect(auditRepository.recordAdminEvent).not.toHaveBeenCalled();
  });

  it('guarda con el ambito resuelto (empresa/sede) y lo audita', async () => {
    const { handler, scopes, matrix, auditRepository } = buildDeps();

    await handler.execute(command(buildCompleteEntries(), 'company-2', 'branch-2'));

    expect(scopes.resolve).toHaveBeenCalledWith('org-1', 'company-2', 'branch-2');
    expect(matrix.saveNewVersion).toHaveBeenCalledWith('org-1', expect.any(Array), 'uid-admin', { companyId: 'company-2', branchId: 'branch-2' }, FAKE_TX);
    expect(auditRepository.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ scope: { companyId: 'company-2', branchId: 'branch-2' } }) }),
      FAKE_TX,
    );
  });

  it('un ambito invalido corta antes de abrir la transaccion', async () => {
    const { handler, scopes, transactionManager } = buildDeps();
    scopes.resolve.mockRejectedValue(new BadRequestException({ code: 'MATRIX_SCOPE_INVALID' }));

    await expect(handler.execute(command(buildCompleteEntries(), null, 'branch-2'))).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionManager.run).not.toHaveBeenCalled();
  });
});
