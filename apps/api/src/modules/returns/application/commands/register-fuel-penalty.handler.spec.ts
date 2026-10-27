import { ForbiddenException } from '@nestjs/common';
import { RegisterReturnFuelPenaltyHandler } from './register-fuel-penalty.handler';
import { RegisterReturnFuelPenaltyCommand } from './register-fuel-penalty.command';
import { InvalidFuelPenaltyError, ReturnStateConflictError } from '../../domain/return-errors';
import { ReturnRecord } from '../ports/return-repository.port';
import { applyUpdate, buildDeps, buildReturnRecord, FIXED_NOW, fakeTx } from '../../testing/return-test-fixtures';

describe('RegisterReturnFuelPenaltyHandler (DEC-DEV-FUEL-PENALTY-001, ajuste manual de multa de combustible)', () => {
  function build(overrides: Partial<ReturnRecord> = {}, role: 'GERENCIA' | 'CAMPO' | 'FINANZAS' = 'GERENCIA') {
    const deps = buildDeps({ role });
    const base = buildReturnRecord({
      status: 'INSPECCION',
      fuelLevelAtReturn: 'HALF', // 2 líneas faltantes -> calculado 100
      vehicleFuelPenaltyPerLine: 50,
      version: 4,
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const handler = new RegisterReturnFuelPenaltyHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (amount: number, reason = 'Cliente repuso parcialmente') =>
    new RegisterReturnFuelPenaltyCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 4, amount, reason);

  it('ajusta la penalidad de combustible con motivo obligatorio, audita y emite MultaCombustibleAjustada.v1', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(cmd(70, 'Acuerdo comercial autorizado'));

    expect(result.fuelPenaltyAmount).toBe(70);
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 4,
        fuelPenaltyAmount: 70,
        fuelPenaltyNotes: 'Acuerdo comercial autorizado',
        fuelPenaltyRegisteredById: 'uid-1',
        fuelPenaltyRegisteredAt: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_FUEL_PENALTY_ADJUSTED',
        changes: expect.objectContaining({
          returnId: 'ret-1',
          calculatedAmount: 100,
          appliedAmount: 70,
          reason: 'Acuerdo comercial autorizado',
          registeredById: 'uid-1',
        }),
      }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'MultaCombustibleAjustada.v1',
        payload: expect.objectContaining({
          returnId: 'ret-1',
          calculatedAmount: 100,
          appliedAmount: 70,
          reason: 'Acuerdo comercial autorizado',
        }),
      }),
      fakeTx,
    );
  });

  it('rechaza si el monto es negativo -> InvalidFuelPenaltyError', async () => {
    const { handler } = build();
    await expect(handler.execute(cmd(-10))).rejects.toThrow(InvalidFuelPenaltyError);
  });

  it('rechaza si falta motivo o es menor a 3 caracteres -> InvalidFuelPenaltyError', async () => {
    const { handler } = build();
    await expect(handler.execute(cmd(50, ''))).rejects.toThrow(InvalidFuelPenaltyError);
    await expect(handler.execute(cmd(50, 'ok'))).rejects.toThrow(InvalidFuelPenaltyError);
  });

  it('rechaza si la devolución está en estado CERRADA -> ReturnStateConflictError', async () => {
    const { handler } = build({ status: 'CERRADA' });
    await expect(handler.execute(cmd(50))).rejects.toThrow(ReturnStateConflictError);
  });

  it('rol sin permiso CHARGE_IMMOBILIZATION (CAMPO) es rechazado -> 403', async () => {
    const { handler } = build({}, 'CAMPO');
    await expect(handler.execute(cmd(50))).rejects.toThrow(ForbiddenException);
  });
});
