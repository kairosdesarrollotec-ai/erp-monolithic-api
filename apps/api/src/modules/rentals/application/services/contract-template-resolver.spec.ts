import { ContractTemplateResolver } from './contract-template-resolver';
import { TemplateRecord, TemplateRepositoryPort } from '../../../templates/application/ports/template-repository.port';

function tpl(type: string, id = `tpl-${type}`): TemplateRecord {
  return {
    id,
    organizationId: 'org-1',
    companyId: 'comp-1',
    type,
    name: `Plantilla ${type}`,
    version: 2,
    status: 'ACTIVE',
    documentUrl: null,
    documentFormat: 'PDF',
    effectiveFrom: new Date('2026-10-01T00:00:00Z'),
    createdAt: new Date(),
    createdBy: 'uid-admin',
    updatedAt: new Date(),
    updatedBy: 'uid-admin',
  };
}

describe('ContractTemplateResolver (BR-DOC-002/003)', () => {
  function build(active: Record<string, TemplateRecord>) {
    const repo = {
      findActive: jest.fn(async (_c: string, type: string) => active[type] ?? null),
    } as unknown as jest.Mocked<TemplateRepositoryPort>;
    return { repo, resolver: new ContractTemplateResolver(repo) };
  }

  it('con combinacion y plantilla especifica vigente: usa la especifica', async () => {
    const { repo, resolver } = build({
      RENTAL_CONTRACT_LEGAL_DRIVER: tpl('RENTAL_CONTRACT_LEGAL_DRIVER'),
      RENTAL_CONTRACT: tpl('RENTAL_CONTRACT'),
    });
    const r = await resolver.resolve('comp-1', 'org-1', { holderType: 'LEGAL', withCompanyDriver: true });
    expect(r.template?.type).toBe('RENTAL_CONTRACT_LEGAL_DRIVER');
    expect(r.requestedType).toBe('RENTAL_CONTRACT_LEGAL_DRIVER');
    expect(r.fallbackUsed).toBe(false);
    expect(repo.findActive).toHaveBeenCalledTimes(1);
  });

  it('cada combinacion busca SU tipo (natural sin conductor != natural con conductor)', async () => {
    const { resolver } = build({
      RENTAL_CONTRACT_NATURAL: tpl('RENTAL_CONTRACT_NATURAL'),
      RENTAL_CONTRACT_NATURAL_DRIVER: tpl('RENTAL_CONTRACT_NATURAL_DRIVER'),
    });
    expect((await resolver.resolve('comp-1', 'org-1', { holderType: 'NATURAL', withCompanyDriver: false })).template?.id).toBe(
      'tpl-RENTAL_CONTRACT_NATURAL',
    );
    expect((await resolver.resolve('comp-1', 'org-1', { holderType: 'NATURAL', withCompanyDriver: true })).template?.id).toBe(
      'tpl-RENTAL_CONTRACT_NATURAL_DRIVER',
    );
  });

  it('sin plantilla de esa combinacion cae a la generica y lo indica', async () => {
    const { resolver } = build({ RENTAL_CONTRACT: tpl('RENTAL_CONTRACT') });
    const r = await resolver.resolve('comp-1', 'org-1', { holderType: 'LEGAL', withCompanyDriver: false });
    expect(r.template?.type).toBe('RENTAL_CONTRACT');
    expect(r.requestedType).toBe('RENTAL_CONTRACT_LEGAL');
    expect(r.fallbackUsed).toBe(true);
  });

  it('sin ninguna vigente: template null y sin fallback', async () => {
    const { resolver } = build({});
    const r = await resolver.resolve('comp-1', 'org-1', { holderType: 'NATURAL', withCompanyDriver: false });
    expect(r).toEqual({ template: null, requestedType: 'RENTAL_CONTRACT_NATURAL', fallbackUsed: false });
  });

  it('sin combinacion: solo la generica (compatibilidad con clientes antiguos)', async () => {
    const { repo, resolver } = build({
      RENTAL_CONTRACT: tpl('RENTAL_CONTRACT'),
      RENTAL_CONTRACT_NATURAL: tpl('RENTAL_CONTRACT_NATURAL'),
    });
    const r = await resolver.resolve('comp-1', 'org-1');
    expect(r.template?.type).toBe('RENTAL_CONTRACT');
    expect(r.fallbackUsed).toBe(false);
    expect(repo.findActive).toHaveBeenCalledWith('comp-1', 'RENTAL_CONTRACT', 'org-1');
  });
});
