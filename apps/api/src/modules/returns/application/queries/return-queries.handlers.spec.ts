import { GetReturnHandler } from './get-return.handler';
import { GetReturnQuery } from './get-return.query';
import { ListReturnsHandler } from './list-returns.handler';
import { ListReturnsQuery } from './list-returns.query';
import { ListReturnEvidenceHandler } from './list-return-evidence.handler';
import { ListReturnEvidenceQuery } from './list-return-evidence.query';
import { ReturnNotFoundError, ReturnRoleNotAllowedError } from '../../domain/return-errors';
import { buildDeps, buildReturnRecord, TEST_SCOPE } from '../../testing/return-test-fixtures';

describe('Consultas de Devolución', () => {
  it('get: devuelve el expediente dentro del scope de la sesión (organización real de la asignación)', async () => {
    const deps = buildDeps({ role: 'AUDITORIA' });
    deps.returns.findById.mockResolvedValue(buildReturnRecord());
    const found = await new GetReturnHandler(deps.access, deps.returns).execute(
      new GetReturnQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'),
    );
    expect(found.id).toBe('ret-1');
    expect(deps.returns.findById).toHaveBeenCalledWith('ret-1', TEST_SCOPE);
  });

  it('get: inexistente en el scope -> ReturnNotFoundError; rol RRHH no lee', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    deps.returns.findById.mockResolvedValue(null);
    await expect(
      new GetReturnHandler(deps.access, deps.returns).execute(new GetReturnQuery('x', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(ReturnNotFoundError);

    const forbidden = buildDeps({ role: 'RRHH' });
    await expect(
      new GetReturnHandler(forbidden.access, forbidden.returns).execute(new GetReturnQuery('x', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(ReturnRoleNotAllowedError);
  });

  it('list: aplica scope, filtro de estado, límite y cursor keyset', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    deps.returns.list.mockResolvedValue([buildReturnRecord()]);
    const cursor = { createdAt: new Date('2026-10-01T00:00:00Z'), id: 'ret-0' };
    const rows = await new ListReturnsHandler(deps.access, deps.returns).execute(
      new ListReturnsQuery('uid-1', 'comp-1', 'branch-1', 'INSPECCION', 10, cursor),
    );
    expect(rows).toHaveLength(1);
    expect(deps.returns.list).toHaveBeenCalledWith({ ...TEST_SCOPE, status: 'INSPECCION', limit: 10, cursor });
  });

  it('list evidence: valida que la devolución exista y lista la evidencia', async () => {
    const deps = buildDeps({ role: 'CAMPO' });
    deps.returns.findById.mockResolvedValue(buildReturnRecord());
    deps.returns.listEvidences.mockResolvedValue([]);
    await new ListReturnEvidenceHandler(deps.access, deps.returns).execute(
      new ListReturnEvidenceQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'),
    );
    expect(deps.returns.listEvidences).toHaveBeenCalledWith('ret-1', TEST_SCOPE);

    deps.returns.findById.mockResolvedValue(null);
    await expect(
      new ListReturnEvidenceHandler(deps.access, deps.returns).execute(new ListReturnEvidenceQuery('x', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(ReturnNotFoundError);
  });
});
