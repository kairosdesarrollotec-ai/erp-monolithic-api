import { ResolveAlcoholEscalationHandler } from './resolve-alcohol-escalation.handler';
import { ResolveAlcoholEscalationCommand } from './resolve-alcohol-escalation.command';
import {
  ReturnNotFoundError,
  ReturnRoleNotAllowedError,
  ReturnStateConflictError,
  ReturnVersionConflictError,
} from '../../domain/return-errors';
import type { WorkerRole } from '../../../users/domain/worker-role';
import type { AlcoholTestResult, ReturnStatus } from '../../domain/return-status';
import { applyUpdate, buildDeps, buildReturnRecord, FIXED_NOW, fakeTx } from '../../testing/return-test-fixtures';

describe('ResolveAlcoholEscalationHandler (DEV-04 / BR-DEV-005 / PROP-014 provisional)', () => {
  function build(
    options: { role?: WorkerRole; status?: ReturnStatus; alcohol?: AlcoholTestResult | null } = {},
  ) {
    const status = options.status ?? 'RECEPCION_PROVISIONAL';
    const alcohol = options.alcohol === undefined ? 'DESFAVORABLE' : options.alcohol;
    const deps = buildDeps({ role: options.role ?? 'GERENCIA' });
    const base = buildReturnRecord({
      status,
      custodyHolder: 'VELOXRENT',
      alcoholTestResult: alcohol,
      version: 4,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const handler = new ResolveAlcoholEscalationHandler(
      deps.access,
      deps.returns,
      deps.customerRisk,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const cmd = (decision: 'CONTINUE_TO_INSPECTION' | 'KEEP_IN_CUSTODY', markCustomerRed = false) =>
    new ResolveAlcoholEscalationCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 4, decision, markCustomerRed, ' Gerencia autoriza ');

  it('solo GERENCIA (y PLATFORM_ADMIN): el resto de roles recibe ROLE_NOT_ALLOWED sin tocar nada', async () => {
    for (const role of ['CAMPO', 'FRONT_OFFICE', 'ADMINISTRACION', 'FINANZAS', 'AUDITORIA', 'RRHH'] as WorkerRole[]) {
      const { deps, handler } = build({ role });
      await expect(handler.execute(cmd('CONTINUE_TO_INSPECTION'))).rejects.toThrow(ReturnRoleNotAllowedError);
      expect(deps.returns.update).not.toHaveBeenCalled();
      expect(deps.customerRisk.escalate).not.toHaveBeenCalled();
    }
    const gerencia = build({ role: 'GERENCIA' });
    await expect(gerencia.handler.execute(cmd('CONTINUE_TO_INSPECTION'))).resolves.toBeDefined();
  });

  it('CONTINUE_TO_INSPECTION pasa a INSPECCION con custodia VELOXRENT y registra la decisión', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(cmd('CONTINUE_TO_INSPECTION'));

    expect(result.status).toBe('INSPECCION');
    expect(result.version).toBe(5);
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 4,
        status: 'INSPECCION',
        custodyHolder: 'VELOXRENT',
        alcoholEscalationDecision: 'CONTINUE_TO_INSPECTION',
        alcoholEscalationMarkedRed: false,
        alcoholEscalationNotes: 'Gerencia autoriza',
        alcoholEscalationDecidedById: 'uid-1',
        alcoholEscalationDecidedAt: FIXED_NOW,
      }),
      fakeTx,
    );
    expect(deps.customerRisk.escalate).not.toHaveBeenCalled();
  });

  it('KEEP_IN_CUSTODY permanece en RECEPCION_PROVISIONAL y puede volver a resolverse', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(cmd('KEEP_IN_CUSTODY'));
    expect(result.status).toBe('RECEPCION_PROVISIONAL');
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, alcoholEscalationDecision: 'KEEP_IN_CUSTODY' }),
      fakeTx,
    );

    // Segunda resolución sobre el mismo expediente (aún RECEPCION_PROVISIONAL): permitida y auditada de nuevo.
    await expect(handler.execute(cmd('CONTINUE_TO_INSPECTION'))).resolves.toMatchObject({ status: 'INSPECCION' });
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledTimes(2);
  });

  it('RECHAZADO también es resoluble', async () => {
    const { handler } = build({ alcohol: 'RECHAZADO' });
    await expect(handler.execute(cmd('KEEP_IN_CUSTODY'))).resolves.toBeDefined();
  });

  it('markCustomerRed=true escala Customer.status a ROJO en la misma transacción', async () => {
    const { deps, handler } = build();
    await handler.execute(cmd('CONTINUE_TO_INSPECTION', true));
    expect(deps.customerRisk.escalate).toHaveBeenCalledWith(
      { customerId: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', target: 'ROJO' },
      fakeTx,
    );
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_ALCOHOL_ESCALATION_RESOLVED',
        changes: expect.objectContaining({ markCustomerRed: true, customerRiskStatus: 'ROJO' }),
      }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DevolucionAlcoholResueltoPorGerencia.v1',
        payload: expect.objectContaining({ decision: 'CONTINUE_TO_INSPECTION', customerRiskStatus: 'ROJO', status: 'INSPECCION' }),
      }),
      fakeTx,
    );
  });

  it('publica evento y audit también cuando no se marca ROJO', async () => {
    const { deps, handler } = build();
    await handler.execute(cmd('KEEP_IN_CUSTODY', false));
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_ALCOHOL_ESCALATION_RESOLVED' }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DevolucionAlcoholResueltoPorGerencia.v1',
        payload: expect.objectContaining({ customerRiskStatus: null }),
      }),
      fakeTx,
    );
  });

  it('alcolímetro FAVORABLE o sin registrar -> 409 RETURN_STATE_CONFLICT', async () => {
    for (const alcohol of ['FAVORABLE', null] as const) {
      const { deps, handler } = build({ alcohol });
      const error = await handler.execute(cmd('CONTINUE_TO_INSPECTION')).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ReturnStateConflictError);
      expect((error as ReturnStateConflictError).code).toBe('RETURN_STATE_CONFLICT');
      expect((error as ReturnStateConflictError).httpStatus).toBe(409);
      expect(deps.returns.update).not.toHaveBeenCalled();
    }
  });

  it.each<ReturnStatus>(['PROGRAMADA', 'INSPECCION', 'CON_DANOS', 'CERRADA'])(
    'estado %s distinto de RECEPCION_PROVISIONAL -> 409 RETURN_STATE_CONFLICT',
    async (status) => {
      const { deps, handler } = build({ status });
      await expect(handler.execute(cmd('CONTINUE_TO_INSPECTION'))).rejects.toThrow(ReturnStateConflictError);
      expect(deps.returns.update).not.toHaveBeenCalled();
    },
  );

  it('expediente inexistente -> ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);
    await expect(handler.execute(cmd('KEEP_IN_CUSTODY'))).rejects.toThrow(ReturnNotFoundError);
  });

  it('versión desfasada (If-Match) se propaga como ReturnVersionConflictError', async () => {
    const { deps, handler } = build();
    deps.returns.update.mockRejectedValue(new ReturnVersionConflictError());
    await expect(handler.execute(cmd('CONTINUE_TO_INSPECTION'))).rejects.toThrow(ReturnVersionConflictError);
    expect(deps.outboxRepository.publish).not.toHaveBeenCalled();
  });
});
