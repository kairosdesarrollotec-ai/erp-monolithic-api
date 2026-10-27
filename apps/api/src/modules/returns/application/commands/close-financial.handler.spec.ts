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
      deps.openIncidents,
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

  it('DEV-09: una incidencia ABIERTA real del modulo Incidencias bloquea la liquidacion de la garantia', async () => {
    const { deps, handler } = build();
    deps.openIncidents.findOpenIncidentIds.mockResolvedValue(['inc-77', 'inc-78']);

    const error = await handler.execute(cmd(500, 0)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ActiveIncidentsBlockCloseError);
    expect((error as ActiveIncidentsBlockCloseError).httpStatus).toBe(422);
    expect((error as ActiveIncidentsBlockCloseError).extra).toEqual({
      openIncidents: ['INCIDENCIA_ABIERTA(inc-77)', 'INCIDENCIA_ABIERTA(inc-78)'],
    });
    expect(deps.returns.update).not.toHaveBeenCalled();
    expect(deps.settlement.settleDeposit).not.toHaveBeenCalled();
  });

  it('sin incidencias abiertas (cerradas o via legal no cuentan) la liquidacion procede', async () => {
    const { deps, handler } = build();
    deps.openIncidents.findOpenIncidentIds.mockResolvedValue([]);
    await expect(handler.execute(cmd(500, 0))).resolves.toMatchObject({ status: 'CIERRE_FINANCIERO' });
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

  describe('DEC-ALQ-COMPANY-DRIVER-004 - alquiler con conductor de la empresa (sin garantia)', () => {
    function buildNoDeposit() {
      const built = build({}, false);
      built.deps.rentals.findById.mockResolvedValue(
        buildRentalRecord({
          status: 'RETURN_IN_PROGRESS',
          deposit: null,
          contract: { id: 'c1', rentalId: 'rent-1', templateId: null, documentRef: 'd', status: 'SIGNED', signedAt: null, depositRequired: false, createdAt: new Date() },
        }),
      );
      return built;
    }

    it('cierra el financiero con 0/0: sin liquidacion de garantia (N/A) y lo deja en auditoria y evento', async () => {
      const { deps, handler } = buildNoDeposit();

      const result = await handler.execute(cmd(0, 0));

      expect(result.status).toBe('CIERRE_FINANCIERO');
      expect(deps.settlement.settleDeposit).not.toHaveBeenCalled();
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ depositApplicable: false, depositAdjusted: false }) }),
        fakeTx,
      );
    });

    it.each([[500, 0], [0, 100]])('montos > 0 (%s/%s) -> 422 RETURN_NO_DEPOSIT_TO_SETTLE', async (refund, retained) => {
      const { deps, handler } = buildNoDeposit();

      await expect(handler.execute(cmd(refund, retained))).rejects.toMatchObject({ code: 'RETURN_NO_DEPOSIT_TO_SETTLE', httpStatus: 422 });
      expect(deps.returns.update).not.toHaveBeenCalled();
    });
  });

  describe('cargo por retraso imputado en garantía (Decisión 23-oct)', () => {
    it('si hay cargo por retraso registrado, lo retenido debe cubrirlo', async () => {
      const { deps, handler } = build({ lateChargeAmount: 150 });

      // Retenido 100 no cubre 150 -> falla
      await expect(handler.execute(cmd(400, 100))).rejects.toThrow(InvalidFinancialSettlementError);
      expect(deps.returns.update).not.toHaveBeenCalled();

      // Retenido 150 cubre exactamente 150 -> éxito
      const result = await handler.execute(cmd(350, 150));
      expect(result.status).toBe('CIERRE_FINANCIERO');
      expect(deps.settlement.settleDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PARTIALLY_RETAINED',
          adjustments: [
            expect.objectContaining({ type: 'RELEASE', amount: 350 }),
            expect.objectContaining({ type: 'DISCOUNT', amount: 150 }),
          ],
        }),
        fakeTx,
      );
    });

    it('si hay cargos de paralización y retraso simultáneos, lo retenido debe cubrir ambos', async () => {
      const { deps, handler } = build({
        status: 'CON_DANOS',
        damages: [buildDamage({ estimatedAmount: 100 })],
        immobilizationCharges: [buildCharge({ totalAmount: 120 })],
        lateChargeAmount: 80,
      });

      // Total requerido: 120 + 80 = 200. Retenido 150 -> falla
      await expect(handler.execute(cmd(350, 150))).rejects.toThrow(InvalidFinancialSettlementError);

      // Retenido 250 (cubre 200 + 50 de daños) -> éxito
      const result = await handler.execute(cmd(250, 250));
      expect(result.status).toBe('CIERRE_FINANCIERO');
      expect(deps.settlement.settleDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PARTIALLY_RETAINED',
          adjustments: [
            expect.objectContaining({ type: 'RELEASE', amount: 250 }),
            expect.objectContaining({ type: 'DISCOUNT', amount: 130 }), // 250 - 120 immobilization
          ],
        }),
        fakeTx,
      );
    });

    it('DEC-DEV-FUEL-PENALTY-001: con faltante de combustible no cubierto en retención -> rechaza con 422', async () => {
      const { handler } = build({
        status: 'SIN_DANOS',
        fuelLevelAtReturn: 'HALF',
        vehicleFuelPenaltyPerLine: 50,
      });

      await expect(handler.execute(cmd(500, 0))).rejects.toThrow(
        'Lo retenido (0.00) no cubre la multa por combustible (100.00).',
      );
    });

    it('DEC-DEV-FUEL-PENALTY-001: con faltante de combustible cubierto en retención -> éxito y liquida', async () => {
      const { deps, handler } = build({
        status: 'SIN_DANOS',
        fuelLevelAtReturn: 'HALF',
        vehicleFuelPenaltyPerLine: 50,
      });

      const result = await handler.execute(cmd(400, 100));
      expect(result.status).toBe('CIERRE_FINANCIERO');
      expect(deps.settlement.settleDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PARTIALLY_RETAINED',
          adjustments: [
            expect.objectContaining({ type: 'RELEASE', amount: 400 }),
            expect.objectContaining({ type: 'DISCOUNT', amount: 100 }),
          ],
        }),
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            fuelPenaltyTotal: 100,
          }),
        }),
        fakeTx,
      );
    });

    it('DEC-DEV-FUEL-PENALTY-001: combustible con ajuste manual previo -> usa el monto ajustado', async () => {
      const { handler } = build({
        status: 'SIN_DANOS',
        fuelLevelAtReturn: 'HALF',
        fuelPenaltyAmount: 75,
      });

      await expect(handler.execute(cmd(450, 50))).rejects.toThrow(
        'Lo retenido (50.00) no cubre la multa por combustible (75.00).',
      );

      const result = await handler.execute(cmd(425, 75));
      expect(result.status).toBe('CIERRE_FINANCIERO');
    });

    it('conductor de la empresa sin garantía (deposit = null): liquidación 0/0 pasa sin error', async () => {
      const { handler } = build({ status: 'SIN_DANOS', fuelLevelAtReturn: 'FULL' }, false);
      const result = await handler.execute(cmd(0, 0));
      expect(result.status).toBe('CIERRE_FINANCIERO');
    });
  });
});
