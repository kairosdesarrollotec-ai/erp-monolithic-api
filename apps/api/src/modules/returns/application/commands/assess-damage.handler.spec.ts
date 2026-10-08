import { ForbiddenException } from '@nestjs/common';
import { AssessDamageHandler } from './assess-damage.handler';
import { AssessDamageCommand } from './assess-damage.command';
import {
  ReturnStateConflictError,
  TechnicalDamageRequiresExternalReportError,
  UnknownCosmeticZoneError,
} from '../../domain/return-errors';
import type { CustomerRiskStatus } from '../../domain/customer-risk-status';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { applyUpdate, buildDamage, buildDeps, buildReturnRecord, fakeTx } from '../../testing/return-test-fixtures';

describe('AssessDamageHandler (DEV-06 / DEV-07 / BR-DEV-006)', () => {
  function build(role: WorkerRole = 'GERENCIA', customerRisk: CustomerRiskStatus = 'NORMAL') {
    const deps = buildDeps({ role, customerRisk });
    const base = buildReturnRecord({ status: 'CON_DANOS', custodyHolder: 'VELOXRENT', version: 6 });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    deps.returns.addDamage.mockImplementation(async (input) =>
      buildDamage({
        id: 'dmg-new',
        returnId: input.returnId,
        origin: input.origin,
        severity: input.severity,
        damagedZone: input.damagedZone ?? null,
        estimatedAmount: input.estimatedAmount ?? null,
        externalReportReference: input.externalReportReference ?? null,
        description: input.description ?? null,
      }),
    );
    const handler = new AssessDamageHandler(
      deps.access,
      deps.returns,
      deps.customerRisk,
      deps.transactionManager,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler };
  }

  const aesthetic = () =>
    new AssessDamageCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'AESTHETIC', 'LEVE', 'puerta_lateral_derecha', 9999);

  it('estético: aplica el tarifario fijo por paño (ignora el monto del cliente) y conserva CON_DANOS', async () => {
    const { deps, handler } = build();

    const result = await handler.execute(aesthetic());

    expect(result.damage.estimatedAmount).toBe(180);
    expect(result.damage.damagedZone).toBe('PUERTA_LATERAL_DERECHA');
    expect(result.rentalReturn.status).toBe('CON_DANOS');
    expect(result.rentalReturn.version).toBe(7);
    expect(deps.returns.update).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 6, custodyHolder: undefined }),
      fakeTx,
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PagoAjustado.v1',
        payload: expect.objectContaining({ concept: 'DAMAGE_ASSESSMENT', amount: 180 }),
      }),
      fakeTx,
    );
  });

  it('estético en zona fuera del tarifario -> UnknownCosmeticZoneError', async () => {
    const { deps, handler } = build();
    await expect(
      handler.execute(new AssessDamageCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'AESTHETIC', 'LEVE', 'MOTOR')),
    ).rejects.toThrow(UnknownCosmeticZoneError);
    expect(deps.returns.update).not.toHaveBeenCalled();
  });

  it('técnico sin referencia del informe externo -> TechnicalDamageRequiresExternalReportError (BR-DEV-006)', async () => {
    const { deps, handler } = build();
    await expect(
      handler.execute(new AssessDamageCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'TECHNICAL', 'MODERADO')),
    ).rejects.toThrow(TechnicalDamageRequiresExternalReportError);
    expect(deps.returns.addDamage).not.toHaveBeenCalled();
  });

  it('técnico con informe: registra el monto manual, nunca calculado, y pasa la custodia a TALLER', async () => {
    const { deps, handler } = build();
    const result = await handler.execute(
      new AssessDamageCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'TECHNICAL', 'MODERADO', undefined, 850, 'INFORME-MOTRIX-2026-0847'),
    );
    expect(result.damage).toMatchObject({
      origin: 'TECHNICAL',
      estimatedAmount: 850,
      externalReportReference: 'INFORME-MOTRIX-2026-0847',
    });
    expect(deps.returns.update).toHaveBeenCalledWith(expect.objectContaining({ custodyHolder: 'TALLER' }), fakeTx);
  });

  it('técnico sin monto aún: el monto queda pendiente (null), no se inventa ninguno', async () => {
    const { handler } = build();
    const result = await handler.execute(
      new AssessDamageCommand('ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'TECHNICAL', 'LEVE', undefined, undefined, 'INFORME-2'),
    );
    expect(result.damage.estimatedAmount).toBeNull();
  });

  describe('semáforo del cliente (BR-DEV-007 / BR-DEV-008)', () => {
    const technical = (severity: 'LEVE' | 'MODERADO' | 'GRAVE', accepts?: boolean) =>
      new AssessDamageCommand(
        'ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'TECHNICAL', severity, undefined, 3000, 'INFORME-3', undefined, accepts,
      );
    const aestheticLevel = (severity: 'LEVE' | 'MODERADO', accepts?: boolean) =>
      new AssessDamageCommand(
        'ret-1', 'uid-1', 'comp-1', 'branch-1', 6, 'AESTHETIC', severity, 'capot', undefined, undefined, undefined, accepts,
      );

    it('GRAVE escribe ROJO en la misma transacción y lo deja en auditoría, evento y resultado', async () => {
      const { deps, handler } = build();
      const result = await handler.execute(technical('GRAVE'));
      expect(result.customerRiskStatus).toBe('ROJO');
      expect(deps.customerRisk.escalate).toHaveBeenCalledWith(
        { customerId: 'cust-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', target: 'ROJO' },
        fakeTx,
      );
      expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
        expect.objectContaining({ changes: expect.objectContaining({ customerRiskStatus: 'ROJO' }) }),
        fakeTx,
      );
      expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ customerRiskStatus: 'ROJO' }) }),
        fakeTx,
      );
    });

    it('GRAVE es ROJO aunque el cliente acepte el costo', async () => {
      const { handler } = build();
      expect((await handler.execute(technical('GRAVE', true))).customerRiskStatus).toBe('ROJO');
    });

    it.each(['LEVE', 'MODERADO'] as const)('%s con customerAcceptsCost=true -> AMBAR', async (severity) => {
      const { deps, handler } = build();
      const result = await handler.execute(aestheticLevel(severity, true));
      expect(result.customerRiskStatus).toBe('AMBAR');
      expect(deps.customerRisk.escalate).toHaveBeenCalledWith(expect.objectContaining({ target: 'AMBAR' }), fakeTx);
    });

    it.each([undefined, false])('LEVE con customerAcceptsCost=%s -> sin cambio (NORMAL)', async (accepts) => {
      const { deps, handler } = build();
      const result = await handler.execute(aestheticLevel('LEVE', accepts));
      expect(result.customerRiskStatus).toBe('NORMAL');
      expect(deps.customerRisk.escalate).toHaveBeenCalledWith(expect.objectContaining({ target: 'NORMAL' }), fakeTx);
    });

    it('NO degrada: un cliente ya ROJO sigue ROJO tras un daño leve aceptado o no', async () => {
      for (const accepts of [true, false, undefined]) {
        const { handler } = build('GERENCIA', 'ROJO');
        expect((await handler.execute(aestheticLevel('LEVE', accepts))).customerRiskStatus).toBe('ROJO');
      }
    });

    it('NO degrada: un cliente AMBAR no vuelve a NORMAL con un daño leve no aceptado y sube a ROJO con uno grave', async () => {
      const first = build('GERENCIA', 'AMBAR');
      expect((await first.handler.execute(aestheticLevel('LEVE', false))).customerRiskStatus).toBe('AMBAR');
      const second = build('GERENCIA', 'AMBAR');
      expect((await second.handler.execute(technical('GRAVE'))).customerRiskStatus).toBe('ROJO');
    });
  });

  it('estado distinto de CON_DANOS -> ReturnStateConflictError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(buildReturnRecord({ status: 'SIN_DANOS' }));
    await expect(handler.execute(aesthetic())).rejects.toThrow(ReturnStateConflictError);
  });

  it('rol CAMPO no puede evaluar daños', async () => {
    const { handler } = build('CAMPO');
    await expect(handler.execute(aesthetic())).rejects.toThrow(ForbiddenException);
  });
});
