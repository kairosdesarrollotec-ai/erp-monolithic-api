import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SaveRolePermissionMatrixHandler } from './save-role-permission-matrix.handler';
import { SaveRolePermissionMatrixCommand } from './save-role-permission-matrix.command';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { RolePermissionMatrixPort, RolePermissionEntry } from '../ports/role-permission-matrix.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { PERMISSION_ACTION_CATALOG } from '../../domain/permission-action-catalog';
import { WORKER_ROLES, WorkerRole } from '../../../users/domain/worker-role';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';

function buildCompleteEntries(
  overrides?: { role: WorkerRole; module: RolePermissionEntry['module']; action: string; allowed: boolean }[],
): RolePermissionEntry[] {
  const entries: RolePermissionEntry[] = WORKER_ROLES.flatMap((role) =>
    PERMISSION_ACTION_CATALOG.map((descriptor) => ({
      role,
      module: descriptor.module,
      action: descriptor.action,
      allowed: false,
    })),
  );
  for (const override of overrides ?? []) {
    const target = entries.find(
      (e) => e.role === override.role && e.module === override.module && e.action === override.action,
    );
    if (target) target.allowed = override.allowed;
  }
  return entries;
}

function buildDeps(role: WorkerRole = 'ADMINISTRACION') {
  const authorization = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;

  const adminAuthorization: jest.Mocked<AdminMatrixAuthorizationService> = {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (role !== 'ADMINISTRACION') throw new ForbiddenException();
    }),
  } as any;

  const matrix: jest.Mocked<RolePermissionMatrixPort> = {
    getCurrentVersion: jest.fn().mockResolvedValue({ version: 3, entries: [] }),
    saveNewVersion: jest.fn().mockResolvedValue({ version: 4, entries: [] }),
  };

  const auditRepository = {
    recordAdminEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditEventRepositoryPort>;

  const transactionManager: jest.Mocked<TransactionManagerPort> = {
    run: jest.fn().mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work({})),
  };

  return { authorization, adminAuthorization, matrix, auditRepository, transactionManager };
}

describe('SaveRolePermissionMatrixHandler', () => {
  it('guarda una nueva version y registra el evento de auditoria', async () => {
    const { authorization, adminAuthorization, matrix, auditRepository, transactionManager } = buildDeps();
    const handler = new SaveRolePermissionMatrixHandler(authorization, adminAuthorization, matrix, auditRepository, transactionManager);

    const result = await handler.execute(
      new SaveRolePermissionMatrixCommand('uid-admin', 'company-1', 'branch-1', buildCompleteEntries()),
    );

    expect(result.version).toBe(4);
    expect(matrix.saveNewVersion).toHaveBeenCalledWith('org-1', expect.any(Array), 'uid-admin', {});
    expect(auditRepository.recordAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ROLE_PERMISSION_MATRIX_UPDATED', changes: { previousVersion: 3, newVersion: 4 } }),
      {},
    );
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const { authorization, adminAuthorization, matrix, auditRepository, transactionManager } = buildDeps('FRONT_OFFICE');
    const handler = new SaveRolePermissionMatrixHandler(authorization, adminAuthorization, matrix, auditRepository, transactionManager);

    await expect(
      handler.execute(new SaveRolePermissionMatrixCommand('uid-1', 'company-1', 'branch-1', buildCompleteEntries())),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('rechaza una matriz incompleta', async () => {
    const { authorization, adminAuthorization, matrix, auditRepository, transactionManager } = buildDeps();
    const handler = new SaveRolePermissionMatrixHandler(authorization, adminAuthorization, matrix, auditRepository, transactionManager);
    const incomplete = buildCompleteEntries().slice(1);

    await expect(
      handler.execute(new SaveRolePermissionMatrixCommand('uid-admin', 'company-1', 'branch-1', incomplete)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });

  it('rechaza combinaciones incompatibles de segregacion de funciones', async () => {
    const { authorization, adminAuthorization, matrix, auditRepository, transactionManager } = buildDeps();
    const handler = new SaveRolePermissionMatrixHandler(authorization, adminAuthorization, matrix, auditRepository, transactionManager);
    const conflicting = buildCompleteEntries([
      { role: 'FRONT_OFFICE', module: 'RESERVATION', action: 'REGISTER_PAYMENT', allowed: true },
      { role: 'FRONT_OFFICE', module: 'RESERVATION', action: 'CONFIRM', allowed: true },
    ]);

    await expect(
      handler.execute(new SaveRolePermissionMatrixCommand('uid-admin', 'company-1', 'branch-1', conflicting)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(matrix.saveNewVersion).not.toHaveBeenCalled();
  });
});
