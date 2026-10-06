import { BadRequestException } from '@nestjs/common';
import { MatrixScopeService } from './matrix-scope.service';
import { AdminUserRepositoryPort } from '../ports/admin-user-repository.port';

function build(opts: { companyOk?: boolean; ownership?: boolean } = {}) {
  const { companyOk = true, ownership = true } = opts;
  const adminUsers = {
    companyBelongsToOrganization: jest.fn().mockResolvedValue(companyOk),
    findCompanyBranchOwnership: jest.fn().mockResolvedValue(ownership ? { companyId: 'c', branchId: 'b' } : null),
  } as unknown as jest.Mocked<AdminUserRepositoryPort>;
  return { adminUsers, service: new MatrixScopeService(adminUsers) };
}

describe('MatrixScopeService', () => {
  it('sin ambito = toda la organizacion, sin consultar la base', async () => {
    const { service, adminUsers } = build();

    expect(await service.resolve('org-1', undefined, undefined)).toEqual({ companyId: null, branchId: null });
    expect(await service.resolve('org-1', null, null)).toEqual({ companyId: null, branchId: null });
    expect(adminUsers.companyBelongsToOrganization).not.toHaveBeenCalled();
  });

  it('solo empresa: valida que pertenezca a la organizacion', async () => {
    const { service, adminUsers } = build();

    expect(await service.resolve('org-1', 'c1', null)).toEqual({ companyId: 'c1', branchId: null });
    expect(adminUsers.companyBelongsToOrganization).toHaveBeenCalledWith('org-1', 'c1');
  });

  it('empresa + sede: valida el par contra la organizacion', async () => {
    const { service, adminUsers } = build();

    expect(await service.resolve('org-1', 'c1', 'b1')).toEqual({ companyId: 'c1', branchId: 'b1' });
    expect(adminUsers.findCompanyBranchOwnership).toHaveBeenCalledWith('org-1', 'c1', 'b1');
  });

  it('400 MATRIX_SCOPE_INVALID si hay sede sin empresa', async () => {
    const { service } = build();
    await expect(service.resolve('org-1', null, 'b1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400 COMPANY_BRANCH_NOT_IN_ORGANIZATION si la empresa o el par no son de la organizacion (IDOR)', async () => {
    await expect(build({ companyOk: false }).service.resolve('org-1', 'c-ajena', null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ ownership: false }).service.resolve('org-1', 'c1', 'b-ajena')).rejects.toBeInstanceOf(BadRequestException);
  });
});
