import { ListContractTemplatesHandler } from './list-contract-templates.handler';
import { ListContractTemplatesQuery } from './list-contract-templates.query';
import { RentalRepositoryPort, ContractTemplateRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';

describe('ListContractTemplatesHandler', () => {
  const fakeTemplates: ContractTemplateRecord[] = [
    {
      id: 'tpl-2',
      companyId: 'comp-1',
      type: 'RENTAL_CONTRACT',
      version: 2,
      effectiveFrom: new Date(),
      effectiveTo: null,
      status: 'ACTIVE',
      createdAt: new Date(),
    },
    {
      id: 'tpl-1',
      companyId: 'comp-1',
      type: 'RENTAL_CONTRACT',
      version: 1,
      effectiveFrom: new Date(),
      effectiveTo: new Date(),
      status: 'RETIRED',
      createdAt: new Date(),
    },
  ];

  function buildDeps() {
    const rentals = {
      listContractTemplates: jest.fn().mockResolvedValue(fakeTemplates),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        role: 'GERENCIA',
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    return { rentals, workContext, matrixAuth };
  }

  it('lista las plantillas (activas e historicas) de la empresa', async () => {
    const deps = buildDeps();
    const handler = new ListContractTemplatesHandler(deps.rentals, deps.workContext, deps.matrixAuth);

    const result = await handler.execute(new ListContractTemplatesQuery('uid-1', 'comp-1', 'branch-1'));

    expect(result).toEqual(fakeTemplates);
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'GERENCIA', 'RENTAL', 'MANAGE_CONTRACT_TEMPLATES');
    expect(deps.rentals.listContractTemplates).toHaveBeenCalledWith('comp-1');
  });
});
