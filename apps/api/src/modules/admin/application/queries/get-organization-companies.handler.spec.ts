import { ForbiddenException } from '@nestjs/common';
import { GetOrganizationCompaniesHandler } from './get-organization-companies.handler';
import { GetOrganizationCompaniesQuery } from './get-organization-companies.query';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { AdminUserRepositoryPort, CompanyWithBranches } from '../ports/admin-user-repository.port';
import { AdminMatrixAuthorizationService } from '../services/admin-matrix-authorization.service';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { testRole } from '../../../users/testing/role-fixtures';

function buildWorkContext(role: WorkerRole = 'ADMINISTRACION', rejects?: Error) {
  return {
    authorize: rejects
      ? jest.fn().mockRejectedValue(rejects)
      : jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'company-1', branchId: 'branch-1', ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}

function buildAdminAuthorization(allowed = true) {
  return {
    assertAllowed: jest.fn().mockImplementation(async () => {
      if (!allowed) throw new ForbiddenException();
    }),
  } as unknown as jest.Mocked<AdminMatrixAuthorizationService>;
}

function buildAdminUsers(companies: CompanyWithBranches[] = []) {
  const repo: jest.Mocked<AdminUserRepositoryPort> = {
    listAssignmentsByOrganization: jest.fn(),
    findCompanyBranchOwnership: jest.fn(),
    createOrReactivateAssignment: jest.fn(),
    deactivateAssignment: jest.fn(),
    companyBelongsToOrganization: jest.fn(),
    listEffectiveAssignments: jest.fn(),
    listCompaniesWithBranches: jest.fn().mockResolvedValue(companies),
  };
  return repo;
}

describe('GetOrganizationCompaniesHandler', () => {
  it('devuelve las empresas y sedes de la organizacion del admin', async () => {
    const companies: CompanyWithBranches[] = [
      { companyId: 'company-1', companyName: 'VeloxRent Lima', branches: [{ branchId: 'branch-1', branchName: 'Miraflores' }] },
    ];
    const workContext = buildWorkContext();
    const adminAuthorization = buildAdminAuthorization(true);
    const adminUsers = buildAdminUsers(companies);
    const handler = new GetOrganizationCompaniesHandler(workContext, adminAuthorization, adminUsers);

    const result = await handler.execute(new GetOrganizationCompaniesQuery('uid-admin', 'company-1', 'branch-1'));

    expect(workContext.authorize).toHaveBeenCalledWith({
      firebaseUid: 'uid-admin',
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(adminAuthorization.assertAllowed).toHaveBeenCalledWith('org-1', 'role-ADMINISTRACION', 'MANAGE_USERS', expect.anything());
    expect(adminUsers.listCompaniesWithBranches).toHaveBeenCalledWith('org-1');
    expect(result).toEqual(companies);
  });

  it('rechaza cuando el rol autorizado no tiene MANAGE_USERS', async () => {
    const workContext = buildWorkContext('FRONT_OFFICE');
    const adminAuthorization = buildAdminAuthorization(false);
    const adminUsers = buildAdminUsers();
    const handler = new GetOrganizationCompaniesHandler(workContext, adminAuthorization, adminUsers);

    await expect(
      handler.execute(new GetOrganizationCompaniesQuery('uid-admin', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.listCompaniesWithBranches).not.toHaveBeenCalled();
  });

  it('propaga el 403 de autorizacion cuando la empresa/sede del actor no es vigente', async () => {
    const workContext = buildWorkContext('ADMINISTRACION', new ForbiddenException());
    const adminAuthorization = buildAdminAuthorization(true);
    const adminUsers = buildAdminUsers();
    const handler = new GetOrganizationCompaniesHandler(workContext, adminAuthorization, adminUsers);

    await expect(
      handler.execute(new GetOrganizationCompaniesQuery('uid-admin', 'company-1', 'branch-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
