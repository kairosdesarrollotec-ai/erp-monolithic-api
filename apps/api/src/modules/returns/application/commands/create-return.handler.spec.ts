import { ForbiddenException } from '@nestjs/common';
import { CreateReturnHandler } from './create-return.handler';
import { CreateReturnCommand } from './create-return.command';
import {
  RentalAlreadyHasActiveReturnError,
  RentalNotReturnableError,
  ReturnRentalNotFoundError,
} from '../../domain/return-errors';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { buildDeps, buildRentalRecord, buildReturnRecord, fakeTx, TEST_SCOPE } from '../../testing/return-test-fixtures';

describe('CreateReturnHandler (DEV-01)', () => {
  const command = new CreateReturnCommand('uid-1', 'comp-1', 'branch-1', 'rent-1', new Date('2026-10-06T10:00:00Z'), 'nota');

  function build(role: WorkerRole = 'FRONT_OFFICE') {
    const deps = buildDeps({ role });
    deps.rentals.findById.mockResolvedValue(buildRentalRecord());
    deps.returns.findByRentalId.mockResolvedValue(null);
    deps.returns.create.mockImplementation(async (input) => buildReturnRecord({ id: 'ret-new', ...input, version: 1 } as never));
    const handler = new CreateReturnHandler(
      deps.access,
      deps.returns,
      deps.rentals,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  it('crea la devolución PROGRAMADA con vehículo/cliente del alquiler, auditoría y evento', async () => {
    const { deps, handler } = build();

    const created = await handler.execute(command);

    expect(created.id).toBe('ret-new');
    expect(deps.returns.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        operatingCompanyId: 'comp-1',
        branchId: 'branch-1',
        rentalId: 'rent-1',
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        scheduledAt: command.scheduledAt,
        createdBy: 'uid-1',
      }),
      fakeTx,
    );
    expect(deps.rentals.findById).toHaveBeenCalledWith('rent-1', TEST_SCOPE);
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', action: 'RETURN_SCHEDULED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateType: 'return', eventType: 'DevolucionProgramada.v1' }),
      fakeTx,
    );
  });

  it('alquiler inexistente en la empresa/sede -> ReturnRentalNotFoundError', async () => {
    const { deps, handler } = build();
    deps.rentals.findById.mockResolvedValue(null);
    await expect(handler.execute(command)).rejects.toThrow(ReturnRentalNotFoundError);
    expect(deps.returns.create).not.toHaveBeenCalled();
  });

  it.each(['DRAFT', 'CLOSED', 'CANCELLED', 'EXTENSION_PENDING'] as const)(
    'alquiler en %s -> RentalNotReturnableError',
    async (status) => {
      const { deps, handler } = build();
      deps.rentals.findById.mockResolvedValue(buildRentalRecord({ status }));
      await expect(handler.execute(command)).rejects.toThrow(RentalNotReturnableError);
    },
  );

  it('V-08: con ampliación pendiente el mensaje pide autorizarla o rechazarla primero', async () => {
    const { deps, handler } = build();
    deps.rentals.findById.mockResolvedValue(buildRentalRecord({ status: 'EXTENSION_PENDING' }));
    await expect(handler.execute(command)).rejects.toThrow(/Autorízala o recházala primero/);
  });

  it('alquiler con devolución ya existente -> RentalAlreadyHasActiveReturnError', async () => {
    const { deps, handler } = build();
    deps.returns.findByRentalId.mockResolvedValue(buildReturnRecord());
    await expect(handler.execute(command)).rejects.toThrow(RentalAlreadyHasActiveReturnError);
    expect(deps.returns.create).not.toHaveBeenCalled();
  });

  it('rol CAMPO no puede programar devoluciones (deny-by-default)', async () => {
    const { deps, handler } = build('CAMPO');
    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(deps.rentals.findById).not.toHaveBeenCalled();
  });
});
