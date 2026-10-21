import { CompleteInspectionHandler } from '../../returns/application/commands/complete-inspection.handler';
import { CompleteInspectionCommand } from '../../returns/application/commands/complete-inspection.command';
import { CompleteDeliveryHandler } from '../../rentals/application/commands/complete-delivery.handler';
import { CompleteDeliveryCommand } from '../../rentals/application/commands/complete-delivery.command';
import { SyncConflictPendingError } from '../domain/sync-errors';
import { SyncClosureGateService } from './services/sync-closure-gate.service';
import { InMemorySyncStateRepository, RENTAL_ID, SOURCE_ID } from '../testing/sync-test-fixtures';

/**
 * DEV-04 / ENTREGA-04: "Continuar a Resultado" / "Continuar" siguen deshabilitados hasta SYNCED confirmado por el
 * servidor; por tanto un conflicto abierto bloquea el cierre de la inspeccion y de la entrega (409 SYNC_CONFLICT_PENDING).
 */
describe('bloqueo de cierre por conflicto de sincronizacion', () => {
  const scope = { organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'branch-1' };

  async function gateWithOpenConflict(type: 'ENTREGA' | 'RECEPCION') {
    const repo = new InMemorySyncStateRepository();
    const state = await repo.getOrCreateState({ checklistType: type, sourceId: SOURCE_ID, rentalId: RENTAL_ID, scope }, {} as never);
    await repo.createConflicts(
      [
        {
          stateId: state.id,
          ...scope,
          checklistType: type,
          sourceId: SOURCE_ID,
          rentalId: RENTAL_ID,
          kind: 'FIELD',
          key: 'fuel',
          serverVersion: { value: 'HALF', by: 'a', at: 'x' },
          localVersion: { value: 'FULL', by: 'b', at: 'x' },
          localBaseRev: 0,
          detectedBy: 'b',
          deviceId: null,
        },
      ],
      {} as never,
    );
    return new SyncClosureGateService(repo);
  }

  it('complete-inspection (Devolucion) responde 409 SYNC_CONFLICT_PENDING y no llega a cerrar', async () => {
    const gate = await gateWithOpenConflict('RECEPCION');
    const returns = { findById: jest.fn().mockResolvedValue({ id: SOURCE_ID, status: 'INSPECCION', rentalId: RENTAL_ID }), update: jest.fn() };
    const tm = { run: jest.fn() };
    const access = { authorize: jest.fn().mockResolvedValue({ context: { organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1' }, scope }) };
    const handler = new CompleteInspectionHandler(access as never, returns as never, tm as never, { now: () => new Date() } as never, {} as never, {} as never, gate);
    const err = await handler.execute(new CompleteInspectionCommand(SOURCE_ID, 'uid', 'comp-1', 'branch-1', 1, false)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncConflictPendingError);
    expect((err as SyncConflictPendingError).httpStatus).toBe(409);
    expect((err as SyncConflictPendingError).code).toBe('SYNC_CONFLICT_PENDING');
    expect(tm.run).not.toHaveBeenCalled();
    expect(returns.update).not.toHaveBeenCalled();
  });

  it('complete-delivery (Alquiler) responde 409 SYNC_CONFLICT_PENDING antes de contar evidencia', async () => {
    const gate = await gateWithOpenConflict('ENTREGA');
    const rentals = { findById: jest.fn().mockResolvedValue({ id: SOURCE_ID, status: 'PENDING_DELIVERY' }) };
    const evidence = { countByType: jest.fn() };
    const tm = { run: jest.fn() };
    const workContext = { authorize: jest.fn().mockResolvedValue({ organizationId: 'org-1', companyId: 'comp-1', branchId: 'branch-1', roleId: 'r' }) };
    const matrix = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
    const handler = new CompleteDeliveryHandler(
      rentals as never, {} as never, workContext as never, matrix as never, tm as never, {} as never, {} as never,
      evidence as never, {} as never, { now: () => new Date() } as never, gate,
    );
    await expect(handler.execute(new CompleteDeliveryCommand(SOURCE_ID, 'uid', 'comp-1', 'branch-1', 1))).rejects.toBeInstanceOf(SyncConflictPendingError);
    expect(evidence.countByType).not.toHaveBeenCalled();
    expect(tm.run).not.toHaveBeenCalled();
  });
});
