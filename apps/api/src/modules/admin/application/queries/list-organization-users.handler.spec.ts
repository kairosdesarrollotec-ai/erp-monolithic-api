import { ForbiddenException } from '@nestjs/common';
import { ListOrganizationUsersHandler } from './list-organization-users.handler';
import { ListOrganizationUsersQuery } from './list-organization-users.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort, AdminAssignmentRecord } from '../ports/admin-user-repository.port';
import { IdentityLookupPort } from '../ports/identity-lookup.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';

function buildAuthorization(role: WorkerRole = 'ADMINISTRACION', rejects?: Error) {
  return {
    authorize: rejects
      ? jest.fn().mockRejectedValue(rejects)
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', role }),
  } as unknown as WorkContextAuthorizationService;
}

function buildAdminAuthorization(allowed = true) {
  return {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenException();
    }),
  } as unknown as AdminMatrixAuthorizationService;
}

function buildAdminUsers(records: AdminAssignmentRecord[] = []) {
  const repo: jest.Mocked<AdminUserRepositoryPort> = {
    listAssignmentsByOrganization: jest.fn().mockResolvedValue(records),
    findCompanyBranchOwnership: jest.fn(),
    createOrReactivateAssignment: jest.fn(),
    deactivateAssignment: jest.fn(),
    countActiveByRole: jest.fn(),
  };
  return repo;
}

function buildIdentity(emails: Record<string, string | null> = {}) {
  const repo: jest.Mocked<IdentityLookupPort> = {
    findUidByEmail: jest.fn(),
    provisionUser: jest.fn(),
    findEmailsByUids: jest.fn().mockResolvedValue(emails),
  };
  return repo;
}

describe('ListOrganizationUsersHandler', () => {
  it('lista las asignaciones de la organizacion con correo (identity) y mfaEnrolled derivado', async () => {
    const authorization = buildAuthorization();
    const record: AdminAssignmentRecord = {
      id: 'assign-1',
      firebaseUid: 'uid-1',
      companyId: 'company-1',
      companyName: 'VeloxRent',
      branchId: 'branch-1',
      branchName: 'Sede Central',
      role: 'FRONT_OFFICE',
      active: true,
      mfaEnrolledAt: new Date('2026-09-01T00:00:00Z'),
    };
    const adminUsers = buildAdminUsers([record]);
    const identity = buildIdentity({ 'uid-1': 'usuario@veloxrent.pe' });
    const handler = new ListOrganizationUsersHandler(authorization, buildAdminAuthorization(true), adminUsers, identity);

    const result = await handler.execute(new ListOrganizationUsersQuery('uid-admin', 'company-1', 'branch-1'));

    expect(adminUsers.listAssignmentsByOrganization).toHaveBeenCalledWith('org-1');
    expect(identity.findEmailsByUids).toHaveBeenCalledWith(['uid-1']);
    expect(result).toEqual([
      {
        id: 'assign-1',
        firebaseUid: 'uid-1',
        email: 'usuario@veloxrent.pe',
        companyId: 'company-1',
        companyName: 'VeloxRent',
        branchId: 'branch-1',
        branchName: 'Sede Central',
        role: 'FRONT_OFFICE',
        active: true,
        mfaEnrolled: true,
      },
    ]);
  });

  it('rechaza cuando el rol autorizado no es ADMINISTRACION', async () => {
    const authorization = buildAuthorization('FRONT_OFFICE');
    const handler = new ListOrganizationUsersHandler(authorization, buildAdminAuthorization(false), buildAdminUsers(), buildIdentity());

    await expect(
      handler.execute(new ListOrganizationUsersQuery('uid-1', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propaga el 403 de la autorizacion cuando la combinacion empresa/sede no es vigente', async () => {
    const authorization = buildAuthorization('ADMINISTRACION', new ForbiddenException());
    const handler = new ListOrganizationUsersHandler(authorization, buildAdminAuthorization(true), buildAdminUsers(), buildIdentity());

    await expect(
      handler.execute(new ListOrganizationUsersQuery('uid-1', 'company-ajena', 'branch-ajena')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no llama a la identidad cuando no hay asignaciones', async () => {
    const authorization = buildAuthorization();
    const adminUsers = buildAdminUsers([]);
    const identity = buildIdentity();
    const handler = new ListOrganizationUsersHandler(authorization, buildAdminAuthorization(true), adminUsers, identity);

    const result = await handler.execute(new ListOrganizationUsersQuery('uid-admin', 'company-1', 'branch-1'));

    expect(identity.findEmailsByUids).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
