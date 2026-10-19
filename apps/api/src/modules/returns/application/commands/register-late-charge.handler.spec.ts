import { ForbiddenException } from '@nestjs/common';
import { RegisterReturnLateChargeHandler } from './register-late-charge.handler';
import { RegisterReturnLateChargeCommand } from './register-late-charge.command';
import { InvalidLateChargeError, ReturnNotFoundError, ReturnStateConflictError } from '../../domain/return-errors';
import { ReturnRecord } from '../ports/return-repository.port';
import { applyUpdate, buildDeps, buildReturnRecord, FIXED_NOW, fakeTx } from '../../testing/return-test-fixtures';

describe('RegisterReturnLateChargeHandler (DEC-DEV-LATE-CHARGE-002, cargo por retraso manual)', () => {
  // scheduledAt 10:00Z, receivedAt 11:00Z => 60 min de retraso (> 30 min de tolerancia).
  function build(overrides: Partial<ReturnRecord> = {}, role: 'GERENCIA' | 'CAMPO' | 'FINANZAS' = 'GERENCIA') {
    const deps = buildDeps({ role });
    const base = buildReturnRecord({
      status: 'INSPECCION',
      scheduledAt: new Date('2026-10-05T10:00:00.000Z'),
      receivedAt: new Date('2026-10-05T11:00:00.000Z'),
      version: 4,
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const handler = new RegisterReturnLateChargeHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (amount: number, notes = 'avisó tarde') =>
    new RegisterReturnLateChargeCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 4, amount, notes);

  it('registra el monto digitado (sin cálculo), audita y emite CargoRetrasoRegistrado.v1', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(cmd(37.5));

    expect(result.lateChargeAmount).toBe(37.5);
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 4,
        lateChargeAmount: 37.5,
        lateChargeNotes: 'avisó tarde',
        lateChargeRegisteredById: 'uid-1',
        lateChargeRegisteredAt: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_LATE_CHARGE_REGISTERED',
        changes: expect.objectContaining({ amount: 37.5, manual: true, lateMinutes: 60, previousAmount: null }),
      }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'CargoRetrasoRegistrado.v1',
        payload: expect.objectContaining({ amount: 37.5, manual: true, returnId: 'ret-1' }),
      }),
      fakeTx,
    );
  });

  it('volver a registrar corrige el monto y deja el anterior en la auditoría', async () => {
    const { deps, handler } = build({ lateChargeAmount: 20 });
    await handler.execute(cmd(30));
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ amount: 30, previousAmount: 20 }) }),
      fakeTx,
    );
  });

  it.each([0, -5, Number.NaN])('monto %s -> INVALID_LATE_CHARGE', async (amount) => {
    const { deps, handler } = build();
    await expect(handler.execute(cmd(amount))).rejects.toThrow(InvalidLateChargeError);
    expect(deps.returns.update).not.toHaveBeenCalled();
  });

  it('dentro de la tolerancia (30 min) -> INVALID_LATE_CHARGE', async () => {
    const { deps, handler } = build({ receivedAt: new Date('2026-10-05T10:30:00.000Z') });
    await expect(handler.execute(cmd(10))).rejects.toMatchObject({ code: 'INVALID_LATE_CHARGE' });
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });

  it.each(['PROGRAMADA', 'CERRADA', 'CANCELADA'] as const)('estado %s -> ReturnStateConflictError', async (status) => {
    const { handler } = build({ status });
    await expect(handler.execute(cmd(10))).rejects.toThrow(ReturnStateConflictError);
  });

  it('devolución inexistente -> ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);
    await expect(handler.execute(cmd(10))).rejects.toThrow(ReturnNotFoundError);
  });

  it('autorizado: FINANZAS puede; CAMPO no', async () => {
    const finanzas = build({}, 'FINANZAS');
    await expect(finanzas.handler.execute(cmd(10))).resolves.toBeDefined();
    const campo = build({}, 'CAMPO');
    await expect(campo.handler.execute(cmd(10))).rejects.toThrow(ForbiddenException);
  });
});
