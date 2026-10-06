import { ForbiddenException } from '@nestjs/common';
import { AddIncidentActionHandler } from './add-incident-action.handler';
import { AddIncidentActionCommand } from './add-incident-action.command';
import { ResolveIncidentHandler } from './resolve-incident.handler';
import { ResolveIncidentCommand } from './resolve-incident.command';
import { CloseIncidentHandler } from './close-incident.handler';
import { CloseIncidentCommand } from './close-incident.command';
import { ReferIncidentToLegalHandler } from './refer-incident-to-legal.handler';
import { ReferIncidentToLegalCommand } from './refer-incident-to-legal.command';
import {
  IncidentDirectResolveNotAllowedError,
  IncidentInvalidTextError,
  IncidentNotFoundError,
  IncidentNotOpenError,
  IncidentVersionConflictError,
} from '../../domain/incident-errors';
import { applyAppend, buildDeps, buildIncident, FIXED_NOW, fakeTx } from '../../testing/incident-test-fixtures';
import type { IncidentDetailRecord } from '../ports/incident-repository.port';
import type { WorkerRole } from '../../../users/domain/worker-role';

function setup(base: IncidentDetailRecord = buildIncident({ version: 4 }), role: WorkerRole = 'GERENCIA') {
  const deps = buildDeps({ role });
  deps.incidents.findById.mockResolvedValue(base);
  deps.incidents.appendAction.mockImplementation(async (input) => applyAppend(base, input));
  return {
    deps,
    add: new AddIncidentActionHandler(deps.access, deps.transitions),
    resolve: new ResolveIncidentHandler(deps.access, deps.transitions),
    close: new CloseIncidentHandler(deps.access, deps.transitions),
    refer: new ReferIncidentToLegalHandler(deps.access, deps.transitions),
  };
}

const addCmd = (description = 'Se llamó al cliente') => new AddIncidentActionCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, description);
const resolveCmd = (summary = 'Llave recuperada') => new ResolveIncidentCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, summary);
const closeCmd = (summary = 'Caso resuelto con el cliente') => new CloseIncidentCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, summary);
const referCmd = (reason = 'Cliente no responde, se deriva a Legal') => new ReferIncidentToLegalCommand('inc-1', 'uid-2', 'comp-1', 'branch-1', 4, reason);

describe('AddIncidentActionHandler (INC-02 agregar accion, append-only)', () => {
  it('agrega una entrada ACTION, mantiene ABIERTA, sube version y conserva el historial previo', async () => {
    const { deps, add } = setup();

    const result = await add.execute(addCmd());

    expect(result.status).toBe('ABIERTA');
    expect(result.version).toBe(5);
    expect(result.actions.map((a) => a.kind)).toEqual(['REPORTED', 'ACTION']);
    expect(result.actions[0]).toEqual(buildIncident().actions[0]);
    expect(deps.incidents.appendAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'inc-1',
        expectedVersion: 4,
        kind: 'ACTION',
        description: 'Se llamó al cliente',
        authorUserId: 'uid-2',
        now: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(deps.incidents.appendAction.mock.calls[0][0].nextStatus).toBeUndefined();
    expect(deps.incidents.appendAction.mock.calls[0][0].resolvedAt).toBeUndefined();
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_ACTION_ADDED', incidentId: 'inc-1', actorUserId: 'uid-2' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'IncidentActionAdded.v1', aggregateId: 'inc-1' }),
      fakeTx,
    );
  });

  it('descripcion en blanco -> 400 sin tocar la base', async () => {
    const { deps, add } = setup();
    await expect(add.execute(addCmd('  '))).rejects.toThrow(IncidentInvalidTextError);
    expect(deps.incidents.appendAction).not.toHaveBeenCalled();
  });

  it.each(['CERRADA', 'VIA_LEGAL'] as const)('incidencia %s -> 409 INCIDENT_NOT_OPEN', async (status) => {
    const { deps, add } = setup(buildIncident({ status, version: 4 }));
    await expect(add.execute(addCmd())).rejects.toThrow(IncidentNotOpenError);
    expect(deps.incidents.appendAction).not.toHaveBeenCalled();
    expect(deps.auditRepository.recordIncidentEvent).not.toHaveBeenCalled();
  });

  it('incidencia inexistente o de otro scope -> 404', async () => {
    const { deps, add } = setup();
    deps.incidents.findById.mockResolvedValue(null);
    await expect(add.execute(addCmd())).rejects.toThrow(IncidentNotFoundError);
  });

  it('version desactualizada: el conflicto del repositorio revierte (no audita ni publica)', async () => {
    const { deps, add } = setup();
    deps.incidents.appendAction.mockRejectedValue(new IncidentVersionConflictError());
    await expect(add.execute(addCmd())).rejects.toThrow(IncidentVersionConflictError);
    expect(deps.auditRepository.recordIncidentEvent).not.toHaveBeenCalled();
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('si la auditoria falla, el error se propaga dentro de la transaccion (rollback)', async () => {
    const { deps, add } = setup();
    deps.auditRepository.recordIncidentEvent.mockRejectedValue(new Error('audit down'));
    await expect(add.execute(addCmd())).rejects.toThrow('audit down');
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it.each(['FINANZAS', 'AUDITORIA', 'CAMPO'] as const)('rol %s -> 403', async (role) => {
    const { add } = setup(buildIncident({ version: 4 }), role);
    await expect(add.execute(addCmd())).rejects.toThrow(ForbiddenException);
  });
});

describe('ResolveIncidentHandler (INC-01 resolver directo, solo LEVE)', () => {
  it('LEVE: CERRADA con resumen, resolvedAt = ahora, entrada RESOLVED y evento IncidentResolved.v1', async () => {
    const { deps, resolve } = setup();

    const result = await resolve.execute(resolveCmd());

    expect(result.status).toBe('CERRADA');
    expect(result.resolutionSummary).toBe('Llave recuperada');
    expect(result.resolvedAt).toEqual(FIXED_NOW);
    expect(result.actions.at(-1)).toMatchObject({ kind: 'RESOLVED', description: 'Llave recuperada', authorUserId: 'uid-2' });
    expect(deps.incidents.appendAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'RESOLVED', nextStatus: 'CERRADA', resolutionSummary: 'Llave recuperada', resolvedAt: FIXED_NOW }),
      fakeTx,
    );
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_RESOLVED', changes: expect.objectContaining({ resolutionSummary: 'Llave recuperada' }) }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'IncidentResolved.v1', payload: expect.objectContaining({ status: 'CERRADA' }) }),
      fakeTx,
    );
  });

  it.each(['MODERADA', 'GRAVE'] as const)('severidad %s -> 422 INCIDENT_DIRECT_RESOLVE_NOT_ALLOWED', async (severity) => {
    const { deps, resolve } = setup(buildIncident({ severity, version: 4 }));
    const error = await resolve.execute(resolveCmd()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IncidentDirectResolveNotAllowedError);
    expect((error as IncidentDirectResolveNotAllowedError).httpStatus).toBe(422);
    expect(deps.incidents.appendAction).not.toHaveBeenCalled();
  });

  it('resumen vacio -> 400', async () => {
    const { resolve } = setup();
    await expect(resolve.execute(resolveCmd('   '))).rejects.toThrow(IncidentInvalidTextError);
  });

  it('incidencia ya CERRADA -> 409 INCIDENT_NOT_OPEN', async () => {
    const { resolve } = setup(buildIncident({ status: 'CERRADA', version: 4 }));
    await expect(resolve.execute(resolveCmd())).rejects.toThrow(IncidentNotOpenError);
  });

  it('rol FINANZAS -> 403', async () => {
    const { resolve } = setup(buildIncident({ version: 4 }), 'FINANZAS');
    await expect(resolve.execute(resolveCmd())).rejects.toThrow(ForbiddenException);
  });
});

describe('CloseIncidentHandler (INC-02 cerrar incidencia)', () => {
  it.each(['LEVE', 'MODERADA', 'GRAVE'] as const)('severidad %s: cierra con resumen (entrada CLOSED, IncidentClosed.v1)', async (severity) => {
    const { deps, close } = setup(buildIncident({ severity, version: 4 }));

    const result = await close.execute(closeCmd());

    expect(result.status).toBe('CERRADA');
    expect(result.resolvedAt).toEqual(FIXED_NOW);
    expect(result.actions.at(-1)).toMatchObject({ kind: 'CLOSED', description: 'Caso resuelto con el cliente' });
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'INCIDENT_CLOSED' }), fakeTx);
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'IncidentClosed.v1' }), fakeTx);
  });

  it('resumen vacio -> 400', async () => {
    const { deps, close } = setup();
    await expect(close.execute(closeCmd(''))).rejects.toThrow(IncidentInvalidTextError);
    expect(deps.incidents.findById).not.toHaveBeenCalled();
  });

  it.each(['CERRADA', 'VIA_LEGAL'] as const)('incidencia %s -> 409', async (status) => {
    const { close } = setup(buildIncident({ status, version: 4 }));
    await expect(close.execute(closeCmd())).rejects.toThrow(IncidentNotOpenError);
  });

  it('rol AUDITORIA -> 403', async () => {
    const { close } = setup(buildIncident({ version: 4 }), 'AUDITORIA');
    await expect(close.execute(closeCmd())).rejects.toThrow(ForbiddenException);
  });
});

describe('ReferIncidentToLegalHandler (derivar a via legal)', () => {
  it('pasa a VIA_LEGAL con entrada REFERRED_LEGAL, sin resumen de resolucion ni resolvedAt', async () => {
    const { deps, refer } = setup(buildIncident({ severity: 'GRAVE', version: 4 }));

    const result = await refer.execute(referCmd());

    expect(result.status).toBe('VIA_LEGAL');
    expect(result.resolutionSummary).toBeNull();
    expect(result.resolvedAt).toBeNull();
    expect(result.actions.at(-1)).toMatchObject({ kind: 'REFERRED_LEGAL', description: 'Cliente no responde, se deriva a Legal' });
    expect(deps.auditRepository.recordIncidentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'INCIDENT_REFERRED_LEGAL', changes: expect.objectContaining({ reason: 'Cliente no responde, se deriva a Legal' }) }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'IncidentReferredToLegal.v1', payload: expect.objectContaining({ status: 'VIA_LEGAL' }) }),
      fakeTx,
    );
  });

  it('motivo vacio -> 400; ya terminal -> 409; rol sin permiso -> 403', async () => {
    await expect(setup().refer.execute(referCmd(' '))).rejects.toThrow(IncidentInvalidTextError);
    await expect(setup(buildIncident({ status: 'CERRADA', version: 4 })).refer.execute(referCmd())).rejects.toThrow(IncidentNotOpenError);
    await expect(setup(buildIncident({ version: 4 }), 'FINANZAS').refer.execute(referCmd())).rejects.toThrow(ForbiddenException);
  });
});
