import { CreateContractTemplateHandler } from './create-contract-template.handler';
import { CreateContractTemplateCommand } from './create-contract-template.command';
import { RentalRepositoryPort, ContractTemplateRecord } from '../ports/rental-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';

describe('CreateContractTemplateHandler', () => {
  const fakeTx = {} as any;
  const fakeTemplate: ContractTemplateRecord = {
    id: 'tpl-2',
    companyId: 'comp-1',
    type: 'RENTAL_CONTRACT',
    version: 2,
    effectiveFrom: new Date(),
    effectiveTo: null,
    status: 'ACTIVE',
    createdAt: new Date(),
  };

  function buildDeps(role = 'GERENCIA') {
    const rentals = {
      createContractTemplate: jest.fn().mockResolvedValue(fakeTemplate),
    } as unknown as jest.Mocked<RentalRepositoryPort>;

    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        role,
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;

    const matrixAuth = {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MatrixAuthorizationService>;

    const transactionManager: jest.Mocked<TransactionManagerPort> = {
      run: jest.fn((work: any) => work(fakeTx)),
    };

    return { rentals, workContext, matrixAuth, transactionManager };
  }

  it('crea una nueva version de plantilla delegando en el repositorio dentro de una transaccion', async () => {
    const deps = buildDeps();
    const handler = new CreateContractTemplateHandler(deps.rentals, deps.workContext, deps.matrixAuth, deps.transactionManager);

    const result = await handler.execute(
      new CreateContractTemplateCommand('uid-1', 'comp-1', 'branch-1', 'RENTAL_CONTRACT'),
    );

    expect(result).toEqual(fakeTemplate);
    expect(deps.matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'GERENCIA', 'RENTAL', 'MANAGE_CONTRACT_TEMPLATES');
    expect(deps.rentals.createContractTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'comp-1', type: 'RENTAL_CONTRACT' }),
      fakeTx,
    );
  });

  it('usa effectiveFrom explicito cuando se provee', async () => {
    const deps = buildDeps();
    const handler = new CreateContractTemplateHandler(deps.rentals, deps.workContext, deps.matrixAuth, deps.transactionManager);
    const effectiveFrom = new Date('2026-11-01T00:00:00.000Z');

    await handler.execute(new CreateContractTemplateCommand('uid-1', 'comp-1', 'branch-1', 'RENTAL_CONTRACT', effectiveFrom));

    expect(deps.rentals.createContractTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveFrom }),
      fakeTx,
    );
  });
});
