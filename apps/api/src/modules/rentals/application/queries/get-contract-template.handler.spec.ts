import { NotFoundException } from '@nestjs/common';
import { GetContractTemplateHandler } from './get-contract-template.handler';
import { GetContractTemplateQuery } from './get-contract-template.query';
import { RentalRepositoryPort, RentalRecord } from '../ports/rental-repository.port';
import { ContractTemplateResolver } from '../services/contract-template-resolver';
import { TemplateRecord, TemplateRepositoryPort } from '../../../templates/application/ports/template-repository.port';
import { WorkContextAuthorizationService } from '../../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../../authorization/matrix-authorization.service';
import { testRole } from '../../../users/testing/role-fixtures';

describe('GetContractTemplateHandler (BR-DOC-002/003)', () => {
  const rental = { id: 'rent-1', status: 'CONTRACTING' } as unknown as RentalRecord;
  const tpl = (type: string): TemplateRecord => ({
    id: `tpl-${type}`,
    organizationId: 'org-1',
    companyId: 'comp-1',
    type,
    name: `Contrato ${type}`,
    version: 3,
    status: 'ACTIVE',
    documentUrl: null,
    documentFormat: 'PDF',
    effectiveFrom: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date(),
    createdBy: 'a',
    updatedAt: new Date(),
    updatedBy: 'a',
  });

  function build(active: Record<string, TemplateRecord>, found: RentalRecord | null = rental) {
    const rentals = { findById: jest.fn().mockResolvedValue(found) } as unknown as jest.Mocked<RentalRepositoryPort>;
    const repo = {
      findActive: jest.fn(async (_c: string, type: string) => active[type] ?? null),
    } as unknown as jest.Mocked<TemplateRepositoryPort>;
    const workContext = {
      authorize: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        companyId: 'comp-1',
        branchId: 'branch-1',
        ...testRole('FRONT_OFFICE'),
      }),
    } as unknown as jest.Mocked<WorkContextAuthorizationService>;
    const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MatrixAuthorizationService>;
    const handler = new GetContractTemplateHandler(rentals, workContext, matrixAuth, new ContractTemplateResolver(repo));
    return { handler, rentals, repo, matrixAuth };
  }

  it('devuelve la plantilla de la combinacion pedida', async () => {
    const { handler, matrixAuth } = build({ RENTAL_CONTRACT_NATURAL_DRIVER: tpl('RENTAL_CONTRACT_NATURAL_DRIVER') });

    const result = await handler.execute(
      new GetContractTemplateQuery('rent-1', 'uid-1', 'comp-1', 'branch-1', { holderType: 'NATURAL', withDriver: true }),
    );

    expect(result).toMatchObject({
      rentalId: 'rent-1',
      variant: { holderType: 'NATURAL', withDriver: true },
      requestedType: 'RENTAL_CONTRACT_NATURAL_DRIVER',
      fallbackUsed: false,
      template: { id: 'tpl-RENTAL_CONTRACT_NATURAL_DRIVER', version: 3 },
    });
    expect(matrixAuth.assertAllowed).toHaveBeenCalledWith('org-1', 'role-FRONT_OFFICE', 'RENTAL', 'READ', expect.anything());
  });

  it('sin plantilla especifica: generica con fallbackUsed', async () => {
    const { handler } = build({ RENTAL_CONTRACT: tpl('RENTAL_CONTRACT') });

    const result = await handler.execute(
      new GetContractTemplateQuery('rent-1', 'uid-1', 'comp-1', 'branch-1', { holderType: 'LEGAL', withDriver: false }),
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.template?.type).toBe('RENTAL_CONTRACT');
  });

  it('sin ninguna plantilla vigente: template null', async () => {
    const { handler } = build({});

    const result = await handler.execute(new GetContractTemplateQuery('rent-1', 'uid-1', 'comp-1', 'branch-1'));

    expect(result.template).toBeNull();
    expect(result.variant).toBeNull();
  });

  it('alquiler inexistente en la empresa/sede: NotFoundException', async () => {
    const { handler } = build({}, null);

    await expect(
      handler.execute(new GetContractTemplateQuery('nope', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
