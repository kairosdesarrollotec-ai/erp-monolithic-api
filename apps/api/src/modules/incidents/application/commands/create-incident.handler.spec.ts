import { ForbiddenException } from '@nestjs/common';
import { CreateIncidentHandler } from './create-incident.handler';
import { CreateIncidentCommand } from './create-incident.command';
import { IncidentInvalidTextError, IncidentRentalNotFoundError, IncidentReturnNotFoundError } from '../../domain/incident-errors';
import { buildDeps, buildIncident, FIXED_NOW, fakeTx } from '../../testing/incident-test-fixtures';
import type { WorkerRole } from '../../../users/domain/worker-role';

describe('CreateIncidentHandler (INC-01 Registrar incidencia)', () => {
  function build(role: WorkerRole = 'FRONT_OFFICE') {
    const deps = buildDeps({ role });
    deps.incidents.create.mockImplementation(async (input) =>
      buildIncident({
        rentalId: input.rentalId,
        returnId: input.returnId ?? null,
        type: input.type,
        severity: input.severity,
        description: input.description,
        suggestion: input.suggestion ?? null,
        reportedAt: input.reportedAt,
        responsibleUserId: input.responsibleUserId,
      }),
    );
    const handler = new CreateIncidentHandler(
      deps.access,
      deps.incidents,
      deps.links,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (overrides: Partial<{ returnId: string; description: string; responsibleUserId: string; reportedAt: Date; suggestion: string }> = {}) =>
    new CreateIncidentCommand(
      'uid-1',
      'comp-1',
      'branch-1',
      'rent-1',
      'KEY_LOSS',
      'LEVE',
      overrides.description ?? '  Pérdida de llave  ',
      overrides.returnId,
      overrides.suggestion,
      overrides.reportedAt,
      overrides.responsibleUserId,
    );

  it('crea la incidencia ABIERTA con responsable y fecha por defecto, audita y publica IncidentRegistered.v1 en la misma tx', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(cmd());

    expect(result.status).toBe('ABIERTA');
    expect(deps.incidents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        rentalId: 'rent-1',
        description: 'Pérdida de llave',
        responsibleUserId: 'uid-1',
        reportedAt: FIXED_NOW,
        createdBy: 'uid-1',
        now: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', actorUserId: 'uid-1', action: 'INCIDENT_REGISTERED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'incident',
        eventType: 'IncidentRegistered.v1',
        payload: expect.objectContaining({ rentalId: 'rent-1', severity: 'LEVE', status: 'ABIERTA', organizationId: 'org-1' }),
      }),
      fakeTx,
    );
  });

  it('respeta responsable y fecha de reporte indicados y vincula la devolucion del mismo alquiler', async () => {
    const { deps, handler } = build();
    const reportedAt = new Date('2026-10-05T08:00:00.000Z');

    const result = await handler.execute(cmd({ returnId: 'ret-1', responsibleUserId: 'uid-9', reportedAt, suggestion: 'Duplicar llave' }));

    expect(result.returnId).toBe('ret-1');
    expect(deps.incidents.create).toHaveBeenCalledWith(
      expect.objectContaining({ returnId: 'ret-1', responsibleUserId: 'uid-9', reportedAt, suggestion: 'Duplicar llave' }),
      fakeTx,
    );
  });

  it('alquiler inexistente en la empresa/sede -> 404 RENTAL_NOT_FOUND y no escribe nada', async () => {
    const { deps, handler } = build();
    deps.links.findRental.mockResolvedValue(null);
    await expect(handler.execute(cmd())).rejects.toThrow(IncidentRentalNotFoundError);
    expect(deps.incidents.create).not.toHaveBeenCalled();
    expect(deps.auditRepository.recordIncidentEvent).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('devolucion inexistente o de otro alquiler -> 404 RETURN_NOT_FOUND', async () => {
    const { deps, handler } = build();
    deps.links.findReturn.mockResolvedValueOnce(null);
    await expect(handler.execute(cmd({ returnId: 'ret-x' }))).rejects.toThrow(IncidentReturnNotFoundError);

    deps.links.findReturn.mockResolvedValueOnce({ id: 'ret-2', rentalId: 'otro-alquiler' });
    await expect(handler.execute(cmd({ returnId: 'ret-2' }))).rejects.toThrow(IncidentReturnNotFoundError);
    expect(deps.incidents.create).not.toHaveBeenCalled();
  });

  it('descripcion solo con espacios -> 400', async () => {
    const { deps, handler } = build();
    await expect(handler.execute(cmd({ description: '   ' }))).rejects.toThrow(IncidentInvalidTextError);
    expect(deps.incidents.create).not.toHaveBeenCalled();
  });

  it.each(['FINANZAS', 'AUDITORIA', 'ADMINISTRACION', 'CAMPO', 'RRHH'] as const)('rol %s no puede registrar (403)', async (role) => {
    const { deps, handler } = build(role);
    await expect(handler.execute(cmd())).rejects.toThrow(ForbiddenException);
    expect(deps.incidents.create).not.toHaveBeenCalled();
  });

  it('GERENCIA tambien puede registrar', async () => {
    const { handler } = build('GERENCIA');
    await expect(handler.execute(cmd())).resolves.toBeDefined();
  });
});
