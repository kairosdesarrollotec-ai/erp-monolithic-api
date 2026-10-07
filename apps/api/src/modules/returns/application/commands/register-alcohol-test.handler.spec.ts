import { ForbiddenException } from '@nestjs/common';
import { RegisterReturnAlcoholTestHandler } from './register-alcohol-test.handler';
import { RegisterReturnAlcoholTestCommand } from './register-alcohol-test.command';
import {
  ReturnNotFoundError,
  ReturnStateConflictError,
  ReturnVersionConflictError,
} from '../../domain/return-errors';
import { ReturnStatus } from '../../domain/return-status';
import { applyUpdate, buildDeps, buildReturnRecord, fakeTx } from '../../testing/return-test-fixtures';

describe('RegisterReturnAlcoholTestHandler (DEV-04 / BR-DEV-005 / DR-DEV-003)', () => {
  function build(status: ReturnStatus = 'RECEPCION_PROVISIONAL') {
    const deps = buildDeps({ role: 'CAMPO' });
    deps.returns.findById.mockResolvedValue(
      buildReturnRecord({ status, custodyHolder: 'VELOXRENT', version: 2 }),
    );
    deps.returns.update.mockImplementation(async (input) =>
      applyUpdate(buildReturnRecord({ status, custodyHolder: 'VELOXRENT', version: input.expectedVersion }), input),
    );
    const handler = new RegisterReturnAlcoholTestHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  it('FAVORABLE pasa a INSPECCION y publica DevolucionAlcoholFavorable.v1', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(
      new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE'),
    );
    expect(result.status).toBe('INSPECCION');
    expect(result.alcoholTestResult).toBe('FAVORABLE');
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'INSPECCION', expectedVersion: 2, alcoholTestResult: 'FAVORABLE' }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_ALCOHOL_TEST_PASSED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DevolucionAlcoholFavorable.v1' }),
      fakeTx,
    );
  });

  it.each(['DESFAVORABLE', 'RECHAZADO'] as const)(
    '%s mantiene RECEPCION_PROVISIONAL en custodia de VeloxRent y escala a Gerencia (DR-DEV-003, no falla)',
    async (resultValue) => {
      const { deps, handler } = build();
      const result = await handler.execute(
        new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 2, resultValue, 'aliento etílico'),
      );

      expect(result.status).toBe('RECEPCION_PROVISIONAL');
      expect(result.custodyHolder).toBe('VELOXRENT');
      expect(result.alcoholTestResult).toBe(resultValue);
      expect(deps.returns.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined, custodyHolder: 'VELOXRENT', alcoholTestNotes: 'aliento etílico' }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RETURN_ALCOHOL_TEST_FAILED_ESCALATED',
          changes: expect.objectContaining({ escalatedTo: 'GERENCIA' }),
        }),
        fakeTx,
      );
      expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EscaladoAGerencia.v1',
          payload: expect.objectContaining({ escalatedTo: 'GERENCIA', result: resultValue }),
        }),
        fakeTx,
      );
    },
  );

  it.each(['PROGRAMADA', 'INSPECCION', 'CERRADA'] as const)('estado %s -> ReturnStateConflictError', async (status) => {
    const { deps, handler } = build(status);
    await expect(
      handler.execute(new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE')),
    ).rejects.toThrow(ReturnStateConflictError);
    expect(deps.returns.update).not.toHaveBeenCalled();
  });

  it('devolución inexistente -> ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE')),
    ).rejects.toThrow(ReturnNotFoundError);
  });

  it('propaga ReturnVersionConflictError (If-Match desactualizado) sin publicar eventos', async () => {
    const { deps, handler } = build();
    deps.returns.update.mockRejectedValue(new ReturnVersionConflictError());
    await expect(
      handler.execute(new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 1, 'FAVORABLE')),
    ).rejects.toThrow(ReturnVersionConflictError);
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it('rol FINANZAS no puede registrar alcolímetro', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const handler = new RegisterReturnAlcoholTestHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
    await expect(
      handler.execute(new RegisterReturnAlcoholTestCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 2, 'FAVORABLE')),
    ).rejects.toThrow(ForbiddenException);
  });
});
