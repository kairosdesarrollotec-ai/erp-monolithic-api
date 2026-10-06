import { ChargeImmobilizationHandler } from './charge-immobilization.handler';
import { ChargeImmobilizationCommand } from './charge-immobilization.command';
import {
  ImmobilizationPeriodNotElapsedError,
  InvalidImmobilizationChargeError,
  ReturnDamageNotFoundError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import {
  applyUpdate,
  buildCharge,
  buildDamage,
  buildDeps,
  buildReturnRecord,
  buildTechnicalDamage,
  fakeTx,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';

describe('ChargeImmobilizationHandler (DEV-07 / BR-DEV-011)', () => {
  const RECEIVED_AT = new Date('2026-10-03T10:00:00.000Z');

  function build(overrides: Partial<ReturnRecord> = {}, nowIso = '2026-10-05T12:00:00.000Z') {
    const deps = buildDeps({ role: 'GERENCIA', now: new Date(nowIso) });
    const base = buildReturnRecord({
      status: 'CON_DANOS',
      custodyHolder: 'TALLER',
      receivedAt: RECEIVED_AT,
      version: 8,
      vehicleDailyRate: 100,
      damages: [buildTechnicalDamage()],
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    deps.returns.addImmobilizationCharge.mockImplementation(async (input) =>
      buildCharge({
        id: 'chg-new',
        returnId: input.returnId,
        damageId: input.damageId ?? null,
        daysCharged: input.daysCharged,
        dailyRate: input.dailyRate,
        totalAmount: input.totalAmount,
        notes: input.notes ?? null,
      }),
    );
    const handler = new ChargeImmobilizationHandler(
      deps.access,
      deps.returns,
      deps.settlement,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (days: number, damageId?: string) =>
    new ChargeImmobilizationCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 8, days, damageId, 'sin respuesta del cliente');

  // 2026-10-03T10:00Z -> 2026-10-05T12:00Z = 50h: 24h de gracia + 26h => ceil(26/24) = 2 días cobrables.
  it('pasadas 24h: cobra los días justificados, imputa el ajuste en la garantía y sube la versión', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(cmd(2, 'dmg-tech'));

    expect(result.charge).toMatchObject({ daysCharged: 2, dailyRate: 100, totalAmount: 200, damageId: 'dmg-tech' });
    expect(result.rentalReturn.version).toBe(9);
    expect(deps.returns.addImmobilizationCharge).toHaveBeenCalledWith(
      expect.objectContaining({ daysCharged: 2, dailyRate: 100, totalAmount: 200 }),
      fakeTx,
    );
    expect(deps.settlement.recordImmobilizationCharge).toHaveBeenCalledWith(
      expect.objectContaining({ rentalId: 'rent-1', amount: 200, authorizedBy: 'uid-1' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ concept: 'IMMOBILIZATION_CHARGE', amount: 200 }) }),
      fakeTx,
    );
  });

  it('antes de 24h naturales -> ImmobilizationPeriodNotElapsedError (BR-DEV-011)', async () => {
    const { deps, handler } = build({}, '2026-10-04T09:00:00.000Z');
    await expect(handler.execute(cmd(1))).rejects.toThrow(ImmobilizationPeriodNotElapsedError);
    expect(deps.returns.addImmobilizationCharge).not.toHaveBeenCalled();
    expect(deps.settlement.recordImmobilizationCharge).not.toHaveBeenCalled();
  });

  it('no permite cobrar más días de los que justifica el reloj', async () => {
    const { handler } = build();
    await expect(handler.execute(cmd(3))).rejects.toThrow(InvalidImmobilizationChargeError);
  });

  it('no duplica el cargo: descuenta los días ya cobrados (segunda ejecución)', async () => {
    const { handler } = build({ immobilizationCharges: [buildCharge({ daysCharged: 2, totalAmount: 200 })] });
    await expect(handler.execute(cmd(1))).rejects.toThrow(InvalidImmobilizationChargeError);
  });

  it('sin daño técnico registrado no hay cargo por paralización', async () => {
    const { handler } = build({ damages: [buildDamage()] });
    await expect(handler.execute(cmd(1))).rejects.toThrow(InvalidImmobilizationChargeError);
  });

  it('damageId de un daño estético o ajeno es rechazado', async () => {
    const { handler } = build({ damages: [buildDamage({ id: 'dmg-aes' }), buildTechnicalDamage()] });
    await expect(handler.execute(cmd(1, 'dmg-aes'))).rejects.toThrow(InvalidImmobilizationChargeError);
    await expect(handler.execute(cmd(1, 'otro'))).rejects.toThrow(ReturnDamageNotFoundError);
  });

  it('la tarifa diaria sale del dailyRate vigente del vehículo (TDD §9.3), no del cliente', async () => {
    const { deps, handler } = build({ vehicleDailyRate: 150 });

    const result = await handler.execute(cmd(2, 'dmg-tech'));

    expect(result.charge).toMatchObject({ dailyRate: 150, totalAmount: 300 });
    expect(deps.returns.addImmobilizationCharge).toHaveBeenCalledWith(
      expect.objectContaining({ dailyRate: 150, totalAmount: 300 }),
      fakeTx,
    );
    expect(deps.settlement.recordImmobilizationCharge).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300 }),
      fakeTx,
    );
  });

  it('vehículo sin dailyRate -> 422 INVALID_IMMOBILIZATION_CHARGE y no muta nada', async () => {
    const { deps, handler } = build({ vehicleDailyRate: null });
    const error = await handler.execute(cmd(1)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidImmobilizationChargeError);
    expect((error as InvalidImmobilizationChargeError).code).toBe('INVALID_IMMOBILIZATION_CHARGE');
    expect((error as InvalidImmobilizationChargeError).httpStatus).toBe(422);
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.settlement.recordImmobilizationCharge).not.toHaveBeenCalled();
  });

  it('dailyRate 0 del vehículo también es inválido', async () => {
    const { handler } = build({ vehicleDailyRate: 0 });
    await expect(handler.execute(cmd(1))).rejects.toThrow(InvalidImmobilizationChargeError);
  });

  it('estados fuera de CON_DANOS/CIERRE_FINANCIERO -> ReturnStateConflictError; CIERRE_FINANCIERO permitido', async () => {
    const blocked = build({ status: 'INSPECCION' });
    await expect(blocked.handler.execute(cmd(1))).rejects.toThrow(ReturnStateConflictError);

    const allowed = build({ status: 'CIERRE_FINANCIERO' });
    await expect(allowed.handler.execute(cmd(1))).resolves.toBeDefined();
  });
});
