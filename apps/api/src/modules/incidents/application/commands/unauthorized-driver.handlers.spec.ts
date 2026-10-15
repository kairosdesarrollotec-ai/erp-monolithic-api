import { CreateIncidentHandler } from './create-incident.handler';
import { CreateIncidentCommand } from './create-incident.command';
import { CloseIncidentHandler } from './close-incident.handler';
import { CloseIncidentCommand } from './close-incident.command';
import { ReferIncidentToLegalHandler } from './refer-incident-to-legal.handler';
import { ReferIncidentToLegalCommand } from './refer-incident-to-legal.command';
import { ResolveIncidentHandler } from './resolve-incident.handler';
import { ResolveIncidentCommand } from './resolve-incident.command';
import { AddIncidentActionHandler } from './add-incident-action.handler';
import { AddIncidentActionCommand } from './add-incident-action.command';
import { applyAppend, buildDeps, buildIncident } from '../../testing/incident-test-fixtures';
import type { WorkerRole } from '../../../users/domain/worker-role';

/**
 * DEC-ALQ-UNAUTH-DRIVER-003 - Hoja de Politicas: "solo la persona que firma puede manejar". El usuario decidio que
 * lo decide Gerencia caso por caso: registrar la incidencia no tiene ninguna consecuencia automatica.
 */
describe('Incidencia UNAUTHORIZED_DRIVER (conductor no autorizado)', () => {
  const unauthorized = (over: Partial<ReturnType<typeof buildIncident>> = {}) =>
    buildIncident({ type: 'UNAUTHORIZED_DRIVER', severity: 'GRAVE', version: 4, ...over });

  function setup(role: WorkerRole, base = unauthorized()) {
    const deps = buildDeps({ role });
    deps.incidents.findById.mockResolvedValue(base);
    deps.incidents.appendAction.mockImplementation(async (input) => applyAppend(base, input));
    deps.incidents.create.mockImplementation(async (input) =>
      buildIncident({ type: input.type, severity: input.severity, description: input.description }),
    );
    return {
      deps,
      create: new CreateIncidentHandler(deps.access, deps.incidents, deps.links, deps.transactionManager, deps.clock, deps.auditRepository, deps.outboxRepository),
      add: new AddIncidentActionHandler(deps.access, deps.transitions),
      resolve: new ResolveIncidentHandler(deps.access, deps.transitions),
      close: new CloseIncidentHandler(deps.access, deps.transitions),
      refer: new ReferIncidentToLegalHandler(deps.access, deps.transitions),
    };
  }

  const create = (severity: 'LEVE' | 'MODERADA' | 'GRAVE') =>
    new CreateIncidentCommand('uid-1', 'comp-1', 'branch-1', 'rent-1', 'UNAUTHORIZED_DRIVER', severity, 'Manejaba un tercero');
  const close = () => new CloseIncidentCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, 'Gerencia decide mantener el contrato');
  const refer = () => new ReferIncidentToLegalCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, 'Gerencia resuelve el contrato');

  it.each(['FRONT_OFFICE', 'GERENCIA', 'CAMPO'] as const)('%s puede registrarla (GRAVE) y NO hay consecuencias automaticas', async (role) => {
    const { deps, create: handler } = setup(role);

    const result = await handler.execute(create('GRAVE'));

    expect(result.status).toBe('ABIERTA');
    expect(deps.incidents.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'UNAUTHORIZED_DRIVER', severity: 'GRAVE' }), expect.anything());
    // Solo auditoria + evento de incidencia: nada de retencion de garantia, resolucion de contrato o cliente rojo.
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledTimes(1);
    expect(deps.outboxRepository.publish).toHaveBeenCalledTimes(1);
    expect(deps.outboxRepository.publish.mock.calls[0][0].eventType).toBe('IncidentRegistered.v1');
  });

  it.each(['LEVE', 'MODERADA'] as const)('severidad %s -> 422 INCIDENT_SEVERITY_NOT_ALLOWED_FOR_TYPE', async (severity) => {
    const { deps, create: handler } = setup('GERENCIA');
    await expect(handler.execute(create(severity))).rejects.toMatchObject({ code: 'INCIDENT_SEVERITY_NOT_ALLOWED_FOR_TYPE', httpStatus: 422 });
    expect(deps.incidents.create).not.toHaveBeenCalled();
  });

  it('Gerencia cierra con la decision registrada en el historial (CLOSED)', async () => {
    const { deps, close: handler } = setup('GERENCIA');

    const result = await handler.execute(close());

    expect(result.status).toBe('CERRADA');
    expect(deps.incidents.appendAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'CLOSED', description: 'Gerencia decide mantener el contrato', authorUserId: 'uid-2' }),
      expect.anything(),
    );
  });

  it('Gerencia deriva a via legal con su motivo (REFERRED_LEGAL)', async () => {
    const { deps, refer: handler } = setup('GERENCIA');

    const result = await handler.execute(refer());

    expect(result.status).toBe('VIA_LEGAL');
    expect(deps.incidents.appendAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'REFERRED_LEGAL' }), expect.anything());
  });

  it('Front-office (con permiso CLOSE/REFER_LEGAL en la matriz) NO decide: 403 MANAGEMENT_DECISION_REQUIRED', async () => {
    const { deps, close: closeHandler, refer: referHandler, resolve } = setup('FRONT_OFFICE');

    await expect(closeHandler.execute(close())).rejects.toMatchObject({ code: 'MANAGEMENT_DECISION_REQUIRED', httpStatus: 403 });
    await expect(referHandler.execute(refer())).rejects.toMatchObject({ code: 'MANAGEMENT_DECISION_REQUIRED', httpStatus: 403 });
    await expect(
      resolve.execute(new ResolveIncidentCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, 'x')),
    ).rejects.toBeDefined();
    expect(deps.incidents.appendAction).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('Front-office si puede agregar acciones de seguimiento (no son una decision)', async () => {
    const { deps, add } = setup('FRONT_OFFICE');

    const result = await add.execute(new AddIncidentActionCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, 'Se llamo al cliente'));

    expect(result.status).toBe('ABIERTA');
    expect(deps.incidents.appendAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ACTION' }), expect.anything());
  });

  it('otros tipos conservan el comportamiento previo: Front-office sigue cerrando una incidencia comun', async () => {
    const { close: handler } = setup('FRONT_OFFICE', buildIncident({ type: 'KEY_LOSS', severity: 'MODERADA', version: 4 }));
    await expect(handler.execute(close())).resolves.toMatchObject({ status: 'CERRADA' });
  });
});
