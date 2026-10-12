import { PrismaDepositRepository } from './prisma-deposit.repository';
import type { DepositScope } from '../../application/ports/deposit-repository.port';

/**
 * P0 — aislamiento multiempresa: findById con companyId incorrecto devuelve null.
 * Prueba con mock de PrismaService (sin base de datos real).
 */
describe('PrismaDepositRepository — aislamiento multiempresa (INV-PAG-005)', () => {
  const COMPANY_A = 'comp-a';
  const COMPANY_B = 'comp-b';

  const makeDeposit = (companyId: string) => ({
    id: 'dep-1',
    rentalId: 'rent-1',
    originalAmount: { toNumber: () => 500 },
    currency: 'PEN',
    status: 'HELD',
    closedAt: null,
    closureNotes: null,
    createdAt: new Date(),
    rental: {
      code: 'ALQ-001',
      operatingCompanyId: companyId,
      customer: { firstName: 'Juan', lastName: 'Rios', businessName: null },
      vehicle: { plate: 'ABC-123' },
    },
    adjustments: [],
  });

  function buildPrismaMock(depositCompany: string) {
    return {
      rentalDeposit: {
        findFirst: jest.fn(({ where }: { where: { id?: string; rental: { operatingCompanyId?: string; branchId?: string } } }) => {
          // Simula la condicion WHERE rental.operating_company_id = scope.companyId
          const deposit = makeDeposit(depositCompany);
          if (where.rental.operatingCompanyId !== depositCompany) return Promise.resolve(null);
          if (where.id && where.id !== deposit.id) return Promise.resolve(null);
          return Promise.resolve(deposit);
        }),
      },
    };
  }

  it('devuelve el deposito cuando el companyId coincide con el del rental', async () => {
    const prismaMock = buildPrismaMock(COMPANY_A);
    const repo = new PrismaDepositRepository(prismaMock as never);

    const scope: DepositScope = { organizationId: 'org-1', companyId: COMPANY_A };
    const result = await repo.findById('dep-1', scope);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('dep-1');
  });

  it('devuelve null cuando el companyId del scope no coincide con el del rental (P0 multiempresa)', async () => {
    const prismaMock = buildPrismaMock(COMPANY_A);
    const repo = new PrismaDepositRepository(prismaMock as never);

    const scope: DepositScope = { organizationId: 'org-1', companyId: COMPANY_B };
    const result = await repo.findById('dep-1', scope);

    expect(result).toBeNull();
  });
});
