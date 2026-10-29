import { ForbiddenException } from '@nestjs/common';
import { CloseReturnHandler } from './close-return.handler';
import { CloseReturnCommand } from './close-return.command';
import {
  ActiveIncidentsBlockCloseError,
  MechanicReportNotAcceptedError,
  RentalNotReturnableError,
  ReturnOfflineChangesPendingError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import {
  applyUpdate,
  buildDamage,
  buildDeps,
  buildRentalRecord,
  buildReturnRecord,
  buildTechnicalDamage,
  FIXED_NOW,
  fakeTx,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';
import { RentalRecord } from '../../../rentals/application/ports/rental-repository.port';

describe('CloseReturnHandler (DEV-09 / DEV-10 / DR-DEV-001)', () => {
  function build(overrides: Partial<ReturnRecord> = {}, rental: Partial<RentalRecord> = {}, role: 'GERENCIA' | 'CAMPO' = 'GERENCIA') {
    const deps = buildDeps({ role });
    const base = buildReturnRecord({
      status: 'CIERRE_FINANCIERO',
      custodyHolder: 'VELOXRENT',
      version: 11,
      finalSettlementAmount: 0,
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    deps.rentals.findById.mockResolvedValue(buildRentalRecord({ status: 'RETURN_IN_PROGRESS', version: 12, ...rental }));
    const handler = new CloseReturnHandler(
      deps.access,
      deps.returns,
      deps.rentals,
      deps.fleetVehicles,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
      deps.openIncidents,
      deps.vehicleCommitments,
    );
    return { deps, handler };
  }

  const cmd = () => new CloseReturnCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 11, 'data:image/png;base64,AAA', true, 'cierre');

  it('sin daños: CERRADA, alquiler CLOSED y vehículo AVAILABLE; publica DevolucionCompletada.v1', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(cmd());

    expect(result.status).toBe('CERRADA');
    expect(result.closedAt).toEqual(FIXED_NOW);
    expect(deps.rentals.transitionStatus).toHaveBeenCalledWith(
      'rent-1',
      expect.objectContaining({ organizationId: 'org-1' }),
      'CLOSED',
      12,
      'uid-1',
      fakeTx,
    );
    expect(deps.fleetVehicles.updateStatus).toHaveBeenCalledWith(
      'veh-1',
      { organizationId: 'org-1', operatingCompanyId: 'comp-1' },
      'AVAILABLE',
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DevolucionCompletada.v1',
        payload: expect.objectContaining({ vehicleStatus: 'AVAILABLE', warrantyActRequested: true }),
      }),
      fakeTx,
    );
    // La firma no se copia a auditoría, solo se deja constancia.
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_CLOSED', changes: expect.objectContaining({ signed: true }) }),
      fakeTx,
    );
  });

  it('DEC-DEV-COMMITMENT-001: libera el compromiso RENTAL del alquiler en la misma transacción (devolución anticipada incluida)', async () => {
    const { deps, handler } = build({}, { expectedEndAt: new Date('2026-10-20T09:00:00.000Z') });
    await handler.execute(cmd());
    expect(deps.vehicleCommitments.releaseRentalCommitment).toHaveBeenCalledWith('rent-1', 'org-1', fakeTx);
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ vehicleCommitmentsReleased: 1 }) }),
      fakeTx,
    );
  });

  it('alquiler sin compromiso (0 filas) cierra igual; sin cierre posible no se libera nada', async () => {
    const { deps, handler } = build();
    deps.vehicleCommitments.releaseRentalCommitment.mockResolvedValue(0);
    await expect(handler.execute(cmd())).resolves.toMatchObject({ status: 'CERRADA' });

    const blocked = build({ damages: [buildTechnicalDamage({ estimatedAmount: null })] });
    await expect(blocked.handler.execute(cmd())).rejects.toThrow(ActiveIncidentsBlockCloseError);
    expect(blocked.deps.vehicleCommitments.releaseRentalCommitment).not.toHaveBeenCalled();
  });

  it('con daño técnico: el vehículo pasa a MAINTENANCE', async () => {
    const { deps, handler } = build({ damages: [buildDamage(), buildTechnicalDamage()], mechanicReportAccepted: true });
    await handler.execute(cmd());
    expect(deps.fleetVehicles.updateStatus).toHaveBeenCalledWith('veh-1', expect.anything(), 'MAINTENANCE');
  });

  it('DEC-DEV-REPORT-001: con daño técnico y sin aceptación de informe mecánico -> 422 MECHANIC_REPORT_NOT_ACCEPTED', async () => {
    const { handler } = build({ damages: [buildTechnicalDamage()], mechanicReportAccepted: false });
    await expect(handler.execute(cmd())).rejects.toThrow(MechanicReportNotAcceptedError);
  });

  it('decisión 28-oct #2: con solo daño estético (tarifario) no se exige el informe mecánico', async () => {
    const { handler } = build({ damages: [buildDamage()], mechanicReportAccepted: false });
    await expect(handler.execute(cmd())).resolves.toMatchObject({ status: 'CERRADA' });
  });

  it('DEC-DEV-OFFLINE-001: con cambios offline pendientes -> 422 RETURN_OFFLINE_CHANGES_PENDING', async () => {
    const { handler } = build();
    const offlineCmd = new CloseReturnCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 11, undefined, false, undefined, true);
    await expect(handler.execute(offlineCmd)).rejects.toThrow(ReturnOfflineChangesPendingError);
  });

  it('Fleet se actualiza al final, después de auditoría y outbox (dentro de la misma transacción)', async () => {
    const { deps, handler } = build();
    await handler.execute(cmd());
    const fleetOrder = deps.fleetVehicles.updateStatus.mock.invocationCallOrder[0];
    expect(fleetOrder).toBeGreaterThan(deps.auditRepository.recordRentalEvent.mock.invocationCallOrder[0]);
    expect(fleetOrder).toBeGreaterThan(deps.outboxRepository.publish.mock.invocationCallOrder[0]);
  });

  it('DR-DEV-001: un daño técnico sin monto (incidencia abierta) impide el cierre', async () => {
    const { deps, handler } = build({ damages: [buildTechnicalDamage({ estimatedAmount: null })] });
    await expect(handler.execute(cmd())).rejects.toThrow(ActiveIncidentsBlockCloseError);
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.fleetVehicles.updateStatus).not.toHaveBeenCalled();
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('DEV-09: una incidencia ABIERTA real del modulo Incidencias impide cerrar (INCIDENT_STILL_OPEN) y no toca flota ni alquiler', async () => {
    const { deps, handler } = build();
    deps.openIncidents.findOpenIncidentIds.mockResolvedValue(['inc-77']);

    const error = await handler.execute(cmd()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ActiveIncidentsBlockCloseError);
    expect((error as ActiveIncidentsBlockCloseError).code).toBe('INCIDENT_STILL_OPEN');
    expect((error as ActiveIncidentsBlockCloseError).httpStatus).toBe(422);
    expect((error as ActiveIncidentsBlockCloseError).extra).toEqual({ openIncidents: ['INCIDENCIA_ABIERTA(inc-77)'] });
    expect(deps.openIncidents.findOpenIncidentIds).toHaveBeenCalledWith(
      { rentalId: 'rent-1', returnId: 'ret-1', scope: { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' } },
      fakeTx,
    );
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
    expect(deps.fleetVehicles.updateStatus).not.toHaveBeenCalled();
  });

  it('con incidencias cerradas o via legal (la consulta no las devuelve) el cierre procede', async () => {
    const { deps, handler } = build();
    deps.openIncidents.findOpenIncidentIds.mockResolvedValue([]);
    await expect(handler.execute(cmd())).resolves.toMatchObject({ status: 'CERRADA' });
  });

  it('INCIDENT_STILL_OPEN responde 422 (TDD §11.4), no 409', async () => {
    const { handler } = build({ damages: [buildTechnicalDamage({ estimatedAmount: null })] });
    const error = await handler.execute(cmd()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ActiveIncidentsBlockCloseError);
    expect((error as ActiveIncidentsBlockCloseError).code).toBe('INCIDENT_STILL_OPEN');
    expect((error as ActiveIncidentsBlockCloseError).httpStatus).toBe(422);
  });

  it('alquiler ya CLOSED: no vuelve a transicionarlo', async () => {
    const { deps, handler } = build({}, { status: 'CLOSED' });
    await handler.execute(cmd());
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('alquiler en un estado que no puede cerrarse -> RentalNotReturnableError', async () => {
    const { deps, handler } = build({}, { status: 'EXTENSION_PENDING' });
    await expect(handler.execute(cmd())).rejects.toThrow(RentalNotReturnableError);
    expect(deps.fleetVehicles.updateStatus).not.toHaveBeenCalled();
  });

  it.each(['SIN_DANOS', 'CON_DANOS', 'INSPECCION', 'CERRADA'] as const)('estado %s -> ReturnStateConflictError', async (status) => {
    const { handler } = build({ status });
    await expect(handler.execute(cmd())).rejects.toThrow(ReturnStateConflictError);
  });

  it('rol CAMPO no puede cerrar', async () => {
    const { handler } = build({}, {}, 'CAMPO');
    await expect(handler.execute(cmd())).rejects.toThrow(ForbiddenException);
  });
});
