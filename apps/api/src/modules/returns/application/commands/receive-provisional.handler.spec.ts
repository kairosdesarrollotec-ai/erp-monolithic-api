import { ReceiveProvisionalHandler } from './receive-provisional.handler';
import { ReceiveProvisionalCommand } from './receive-provisional.command';
import {
  RentalAlreadyHasActiveReturnError,
  RentalNotReturnableError,
  ReturnRentalNotFoundError,
} from '../../domain/return-errors';
import {
  applyUpdate,
  buildDeps,
  buildRentalRecord,
  buildReturnRecord,
  FIXED_NOW,
  fakeTx,
} from '../../testing/return-test-fixtures';

describe('ReceiveProvisionalHandler (DEV-03 / DR-DEV-003)', () => {
  const command = new ReceiveProvisionalCommand('uid-1', 'comp-1', 'branch-1', 'rent-1', 45210, 'HALF', false, 'sin novedades');

  function build() {
    const deps = buildDeps({ role: 'CAMPO' });
    deps.rentals.findById.mockResolvedValue(buildRentalRecord());
    deps.returns.findByRentalId.mockResolvedValue(null);
    deps.returns.create.mockImplementation(async (input) => buildReturnRecord({ id: 'ret-new', ...input, version: 1 } as never));
    deps.returns.update.mockImplementation(async (input) =>
      applyUpdate(buildReturnRecord({ id: input.id, version: input.expectedVersion }), input),
    );
    const handler = new ReceiveProvisionalHandler(
      deps.access,
      deps.returns,
      deps.rentals,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  it('sin expediente previo: lo crea directo en RECEPCION_PROVISIONAL con custodia VELOXRENT y mueve el alquiler a RETURN_IN_PROGRESS', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(command);

    expect(result.status).toBe('RECEPCION_PROVISIONAL');
    expect(deps.returns.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'RECEPCION_PROVISIONAL',
        custodyHolder: 'VELOXRENT',
        customerPresent: false,
        mileageAtReturn: 45210,
        fuelLevelAtReturn: 'HALF',
        receivedAt: FIXED_NOW,
        vehicleId: 'veh-1',
      }),
      fakeTx,
    );
    expect(deps.rentals.transitionStatus).toHaveBeenCalledWith(
      'rent-1',
      expect.objectContaining({ organizationId: 'org-1' }),
      'RETURN_IN_PROGRESS',
      7,
      'uid-1',
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_RECEIVED_PROVISIONALLY' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DevolucionRecibidaProvisional.v1' }),
      fakeTx,
    );
  });

  it('con expediente PROGRAMADA: lo avanza con la versión vigente (optimistic concurrency)', async () => {
    const { deps, handler } = build();
    deps.returns.findByRentalId.mockResolvedValue(buildReturnRecord({ status: 'PROGRAMADA', version: 4, notes: 'previa' }));

    const result = await handler.execute(command);

    expect(deps.returns.create).not.toHaveBeenCalled();
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'RECEPCION_PROVISIONAL',
        custodyHolder: 'VELOXRENT',
        expectedVersion: 4,
        notes: 'previa\nsin novedades',
      }),
      fakeTx,
    );
    expect(result.status).toBe('RECEPCION_PROVISIONAL');
    expect(result.version).toBe(5);
  });

  it('alquiler ya en RETURN_IN_PROGRESS: no vuelve a transicionar el alquiler', async () => {
    const { deps, handler } = build();
    deps.rentals.findById.mockResolvedValue(buildRentalRecord({ status: 'RETURN_IN_PROGRESS' }));

    await handler.execute(command);

    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('expediente que ya pasó de PROGRAMADA -> RentalAlreadyHasActiveReturnError', async () => {
    const { deps, handler } = build();
    deps.returns.findByRentalId.mockResolvedValue(buildReturnRecord({ status: 'INSPECCION' }));
    await expect(handler.execute(command)).rejects.toThrow(RentalAlreadyHasActiveReturnError);
    expect(deps.rentals.transitionStatus).not.toHaveBeenCalled();
  });

  it('alquiler no devolvible -> RentalNotReturnableError; inexistente -> ReturnRentalNotFoundError', async () => {
    const { deps, handler } = build();
    deps.rentals.findById.mockResolvedValue(buildRentalRecord({ status: 'PENDING_DELIVERY' }));
    await expect(handler.execute(command)).rejects.toThrow(RentalNotReturnableError);

    deps.rentals.findById.mockResolvedValue(null);
    await expect(handler.execute(command)).rejects.toThrow(ReturnRentalNotFoundError);
  });
});
