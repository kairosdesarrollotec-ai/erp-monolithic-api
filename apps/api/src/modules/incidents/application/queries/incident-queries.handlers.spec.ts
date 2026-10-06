import { ForbiddenException } from '@nestjs/common';
import { GetIncidentHandler } from './get-incident.handler';
import { GetIncidentQuery } from './get-incident.query';
import { ListIncidentsHandler } from './list-incidents.handler';
import { ListIncidentsQuery } from './list-incidents.query';
import { IncidentNotFoundError } from '../../domain/incident-errors';
import { buildDeps, buildIncident } from '../../testing/incident-test-fixtures';

describe('GetIncidentHandler / ListIncidentsHandler (INC-01 / INC-02 lectura)', () => {
  it.each(['FRONT_OFFICE', 'GERENCIA', 'FINANZAS', 'AUDITORIA', 'CAMPO'] as const)('%s puede ver el detalle dentro de su scope', async (role) => {
    const deps = buildDeps({ role });
    deps.incidents.findById.mockResolvedValue(buildIncident());
    const handler = new GetIncidentHandler(deps.access, deps.incidents);

    const result = await handler.execute(new GetIncidentQuery('inc-1', 'uid-1', 'comp-1', 'branch-1'));

    expect(result.id).toBe('inc-1');
    expect(deps.incidents.findById).toHaveBeenCalledWith('inc-1', { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' });
  });

  it('una incidencia fuera del scope (otra empresa/sede) responde 404', async () => {
    const deps = buildDeps();
    deps.incidents.findById.mockResolvedValue(null);
    await expect(new GetIncidentHandler(deps.access, deps.incidents).execute(new GetIncidentQuery('inc-x', 'uid-1', 'comp-1', 'branch-1'))).rejects.toThrow(
      IncidentNotFoundError,
    );
  });

  it.each(['ADMINISTRACION', 'RRHH'] as const)('%s no puede ver (403)', async (role) => {
    const deps = buildDeps({ role });
    await expect(new GetIncidentHandler(deps.access, deps.incidents).execute(new GetIncidentQuery('inc-1', 'uid-1', 'comp-1', 'branch-1'))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(new ListIncidentsHandler(deps.access, deps.incidents).execute(new ListIncidentsQuery('uid-1', 'comp-1', 'branch-1'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(deps.incidents.list).not.toHaveBeenCalled();
  });

  it('la bandeja pasa scope, filtros, limite y cursor keyset al repositorio', async () => {
    const deps = buildDeps({ role: 'AUDITORIA' });
    deps.incidents.list.mockResolvedValue([buildIncident()]);
    const cursor = { createdAt: new Date('2026-10-06T09:00:00.000Z'), id: 'inc-0' };

    const result = await new ListIncidentsHandler(deps.access, deps.incidents).execute(
      new ListIncidentsQuery('uid-1', 'comp-1', 'branch-1', 'KEY_LOSS', 'LEVE', 'ABIERTA', 'rent-1', 'ret-1', 50, cursor),
    );

    expect(result).toHaveLength(1);
    expect(deps.incidents.list).toHaveBeenCalledWith({
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      branchId: 'branch-1',
      type: 'KEY_LOSS',
      severity: 'LEVE',
      status: 'ABIERTA',
      rentalId: 'rent-1',
      returnId: 'ret-1',
      limit: 50,
      cursor,
    });
  });

  it('limite por defecto 20 cuando no se indica', async () => {
    const deps = buildDeps();
    deps.incidents.list.mockResolvedValue([]);
    await new ListIncidentsHandler(deps.access, deps.incidents).execute(new ListIncidentsQuery('uid-1', 'comp-1', 'branch-1'));
    expect(deps.incidents.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });
});
