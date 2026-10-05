import { CloseFinancialHandler } from './close-financial.handler';
import { CloseFinancialCommand } from './close-financial.command';
import {
  ActiveIncidentsBlockCloseError,
  InvalidFinancialSettlementError,
  ReturnStateConflictError,
} from '../../domain/return-errors';
import {
  applyUpdate,
  buildCharge,
  buildDamage,
  buildDeps,
  buildRentalRecord,
  buildReturnRecord,
  buildTechnicalDamage,
  fakeTx,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';

describe('CloseFinancialHandler (DEV-08 / BR-DEV-001 / DR-DEV-001)', () => {
  function build(overrides: Partial<ReturnRecord> = {}, rentalDeposit = true) {
    const deps = buildDeps({ role: 'FINANZAS' });
    const base = buildReturnRecord({ status: 'SIN_DANOS', custodyHolder: 'VELOXRENT', version: 9, fuelLevelAtReturn: 'FULL', ...overrides });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    deps.rentals.findById.mockResolvedValue(
      rentalDeposit ? buildRentalRecord({ status: 'RETURN_IN_PROGRESS' }) : buildRentalRecord({ status: 'RETURN_IN_PROGRESS', deposit: null }),
    );
    const handler = new CloseFinancialHandler(
      deps.access,
      deps.returns,
      deps.rentals,
      deps.settlement,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (refund: number, retained: number) =>
    new CloseFinancialCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 9, refund, retained, 'liquidación');

  it('sin daños: libera la garantía completa -> CIERRE_FINANCIERO, garantía RETURNED', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(cmd(500, 0));

    expect(result.status).toBe('CIERRE_FINANCIERO');
    expect(result.finalSettlementAmount).toBe(0);
    expect(deps.settlement.settleDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: 'rent-1',
        status: 'RETURNED',
        adjustments: [expect.objectContaining({ type: 'RELEASE', amount: 500 })],
      }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ concept: 'DEPOSIT_SETTLEMENT' }) }),
      fakeTx,
    );
  });

  it('con daños evaluados: retiene parte, descuenta cargos de paralización ya imputados', async () => {
    const { deps, handler } = build({
      status: 'CON_DANOS',
      damages: [buildDamage({ estimatedAmount: 180 }), buildTechnicalDamage()],
      immobilizationCharges: [buildCharge({ totalAmount: 100 })],
    });

    const result = await handler.execute(cmd(300, 200));

    expect(result.finalSettlementAmount).toBe(200);
    expect(deps.settlement.settleDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PARTIALLY_RETAINED',
        adjustments: [
          expect.objectContaining({ type: 'RELEASE', amount: 300 }),
          expect.objectContaining({ type: 'DISCOUNT', amount: 100 }),
        ],
      }),
      fakeTx,
    );
  });

  it('INCIDENT_STILL_OPEN responde 422 (TDD §11.4), no 409', async () => {
    const { handler } = build({ status: 'CON_DANOS', damages: [] });
    const error = await handler.execute(cmd(500, 0)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ActiveIncidentsBlockCloseError);
    expect((error as ActiveIncidentsBlockCloseError).code).toBe('INCIDENT_STILL_OPEN');
    expect((error as ActiveIncidentsBlockCloseError).httpStatus).toBe(422);
  });

  it('DR-DEV-001: CON_DANOS sin daños evaluados (incidencia abierta) bloquea la liquidación', async () => {
    const { deps, handler } = build({ status: 'CON_DANOS', damages: [] });
    await expect(handler.execute(cmd(500, 0))).rejects.toThrow(ActiveIncidentsBlockCloseError);
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.settlement.settleDeposit).not.toHaveBeenCalled();
  });

  it('DR-DEV-001: daño técnico sin monto del informe externo bloquea la liquidación', async () => {
    const { deps, handler } = build({
      status: 'CON_DANOS',
      damages: [buildTechnicalDamage({ estimatedAmount: null })],
    });
    await expect(handler.execute(cmd(500, 0))).rejects.toThrow(ActiveIncidentsBlockCloseError);
    expect(deps.settlement.settleDeposit).not.toHaveBeenCalled();
  });

  it('reembolso + retención que no igualan la garantía -> InvalidFinancialSettlementError', async () => {
    const { deps, handler } = build();
    await expect(handler.execute(cmd(400, 50))).rejects.toThrow(InvalidFinancialSettlementError);
    expect(deps.returns.update).not.toHaveBeenCalled();
  });

  it('alquiler sin garantía registrada: cierra sin ajustar garantía', async () => {
    const { deps, handler } = build({}, false);
    const result = await handler.execute(cmd(0, 0));
    expect(result.status).toBe('CIERRE_FINANCIERO');
    expect(deps.settlement.settleDeposit).not.toHaveBeenCalled();
  });

  it.each(['PROGRAMADA', 'INSPECCION', 'CIERRE_FINANCIERO', 'CERRADA'] as const)(
    'estado %s -> ReturnStateConflictError',
    async (status) => {
      const { handler } = build({ status });
      await expect(handler.execute(cmd(500, 0))).rejects.toThrow(ReturnStateConflictError);
    },
  );
});
