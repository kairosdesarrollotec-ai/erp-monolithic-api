import { ForbiddenException } from '@nestjs/common';
import { GetReturnHandler } from './get-return.handler';
import { GetReturnQuery } from './get-return.query';
import { ListReturnsHandler } from './list-returns.handler';
import { ListReturnsQuery } from './list-returns.query';
import { ListReturnRemindersHandler } from './list-return-reminders.handler';
import { ListReturnRemindersQuery } from './list-return-reminders.query';
import { ListReturnAlertsHandler } from './list-return-alerts.handler';
import { ListReturnAlertsQuery } from './list-return-alerts.query';
import { buildDamage, buildDeps, buildReminder, buildReturnRecord, buildTechnicalDamage, FIXED_NOW, TEST_SCOPE } from '../../testing/return-test-fixtures';

const hoursBeforeNow = (h: number): Date => new Date(FIXED_NOW.getTime() - h * 3_600_000);

describe('Consultas con alertas y recordatorios de Devolución', () => {
  it('get: adjunta las alertas calculadas con el reloj (garantía vencida) y conserva el recordatorio', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    deps.returns.findById.mockResolvedValue(
      buildReturnRecord({ status: 'SIN_DANOS', receivedAt: hoursBeforeNow(26), reminder: buildReminder() }),
    );
    const found = await new GetReturnHandler(deps.access, deps.returns, deps.clock).execute(
      new GetReturnQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'),
    );
    expect(found.alerts?.warrantyRelease).toMatchObject({ level: 'OVERDUE' });
    expect(found.alerts?.immobilization).toBeNull();
    expect(found.reminder?.id).toBe('rem-1');
  });

  it('get/list: adjunta el retraso con tolerancia de 30 min (BR-DEV-003)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const scheduledAt = hoursBeforeNow(1);
    const onTime = buildReturnRecord({ id: 'r-a', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 30 * 60000) });
    const late = buildReturnRecord({ id: 'r-b', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 31 * 60000) });
    deps.returns.findById.mockResolvedValue(late);
    const one = await new GetReturnHandler(deps.access, deps.returns, deps.clock).execute(new GetReturnQuery('r-b', 'uid-1', 'comp-1', 'branch-1'));
    expect(one.lateness).toEqual({ lateToleranceMinutes: 30, lateMinutes: 31, isLate: true, basis: 'RECEIVED' });
    deps.returns.list.mockResolvedValue([onTime, late]);
    const many = await new ListReturnsHandler(deps.access, deps.returns, deps.clock).execute(new ListReturnsQuery('uid-1', 'comp-1', 'branch-1'));
    expect(many.map((r) => r.lateness?.isLate)).toEqual([false, true]);
  });

  it('get/list: adjunta el cargo sugerido por retraso (tarifa del vehículo, garantía y ampliaciones del alquiler)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const scheduledAt = hoursBeforeNow(5);
    const late = buildReturnRecord({
      id: 'r-c', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 90 * 60000),
      vehicleDailyRate: 200, rentalDeposit: { originalAmount: 1000, currency: 'PEN' }, rentalExtensions: [],
    });
    deps.returns.findById.mockResolvedValue(late);
    const one = await new GetReturnHandler(deps.access, deps.returns, deps.clock).execute(new GetReturnQuery('r-c', 'uid-1', 'comp-1', 'branch-1'));
    expect(one.latenessCharge).toMatchObject({
      tier: 'EXTRA_31_120', suggestedTimeCharge: '50.00', suggestedGuaranteePenalty: '200.00', noticeAndPrepaymentVerified: false, severeBreach: false,
    });
    const noDeposit = { ...late, id: 'r-d', rentalDeposit: null, rentalExtensions: undefined };
    deps.returns.list.mockResolvedValue([late, noDeposit]);
    const many = await new ListReturnsHandler(deps.access, deps.returns, deps.clock).execute(new ListReturnsQuery('uid-1', 'comp-1', 'branch-1'));
    expect(many[1].latenessCharge).toMatchObject({ suggestedGuaranteePenalty: null, noticeAndPrepaymentVerified: null, suggestedTimeCharge: '50.00' });
  });

  it('get/list: alerta de inmovilización > 24 h por daño técnico', async () => {
    const deps = buildDeps({ role: 'GERENCIA' });
    const record = buildReturnRecord({
      status: 'CON_DANOS',
      receivedAt: hoursBeforeNow(30),
      damages: [buildTechnicalDamage()],
    });
    deps.returns.findById.mockResolvedValue(record);
    deps.returns.list.mockResolvedValue([record, buildReturnRecord({ status: 'CON_DANOS', receivedAt: hoursBeforeNow(30), damages: [buildDamage()] })]);

    const one = await new GetReturnHandler(deps.access, deps.returns, deps.clock).execute(
      new GetReturnQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'),
    );
    expect(one.alerts?.immobilization).toMatchObject({ pendingDays: 1, dailyRate: 120, suggestedAmount: 120 });

    const many = await new ListReturnsHandler(deps.access, deps.returns, deps.clock).execute(
      new ListReturnsQuery('uid-1', 'comp-1', 'branch-1'),
    );
    expect(many[0].alerts?.immobilization).not.toBeNull();
    expect(many[1].alerts?.immobilization).toBeNull();
  });

  it('sin reloj inyectado (specs/consumidores previos) los handlers usan el reloj del sistema y siguen funcionando', async () => {
    const deps = buildDeps({ role: 'AUDITORIA' });
    deps.returns.findById.mockResolvedValue(buildReturnRecord());
    const found = await new GetReturnHandler(deps.access, deps.returns).execute(new GetReturnQuery('ret-1', 'uid-1', 'comp-1', 'branch-1'));
    expect(found.alerts).toEqual({ warrantyRelease: null, immobilization: null });
  });

  it('reminders: por defecto pendientes + fallidos, con scope de la sesión', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    deps.reminders.list.mockResolvedValue([]);
    await new ListReturnRemindersHandler(deps.access, deps.reminders).execute(
      new ListReturnRemindersQuery('uid-1', 'comp-1', 'branch-1'),
    );
    expect(deps.reminders.list).toHaveBeenCalledWith({ ...TEST_SCOPE, statuses: ['PENDING', 'FAILED'], limit: 50 });

    await new ListReturnRemindersHandler(deps.access, deps.reminders).execute(
      new ListReturnRemindersQuery('uid-1', 'comp-1', 'branch-1', ['SENT'], 10),
    );
    expect(deps.reminders.list).toHaveBeenLastCalledWith({ ...TEST_SCOPE, statuses: ['SENT'], limit: 10 });
  });

  it('reminders: RRHH no lee', async () => {
    const deps = buildDeps({ role: 'RRHH' });
    await expect(
      new ListReturnRemindersHandler(deps.access, deps.reminders).execute(new ListReturnRemindersQuery('uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('alerts', () => {
    function build() {
      const deps = buildDeps({ role: 'FINANZAS' });
      const handler = new ListReturnAlertsHandler(deps.access, deps.alerts, deps.clock);
      return { deps, handler };
    }

    it('devuelve garantía por liberar (DUE_SOON / OVERDUE) e inmovilización sin cobro; ignora lo que no está en alerta', async () => {
      const { deps, handler } = build();
      deps.alerts.listCandidates.mockResolvedValue([
        buildReturnRecord({ id: 'r-overdue', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(25) }),
        buildReturnRecord({ id: 'r-soon', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(21) }),
        buildReturnRecord({ id: 'r-ok', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(10) }),
        buildReturnRecord({ id: 'r-immo', status: 'CON_DANOS', receivedAt: hoursBeforeNow(50), damages: [buildTechnicalDamage()] }),
        buildReturnRecord({
          id: 'r-charged',
          status: 'CON_DANOS',
          receivedAt: hoursBeforeNow(30),
          damages: [buildTechnicalDamage()],
          immobilizationCharges: [{ id: 'c', returnId: 'r-charged', damageId: null, daysCharged: 1, dailyRate: 120, totalAmount: 120, notes: null, createdAt: FIXED_NOW }],
        }),
      ]);

      const items = await handler.execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1'));

      expect(items.map((i) => [i.returnId, i.type])).toEqual([
        ['r-overdue', 'WARRANTY_RELEASE'],
        ['r-soon', 'WARRANTY_RELEASE'],
        ['r-immo', 'IMMOBILIZATION'],
      ]);
      expect(items[0].warrantyRelease?.level).toBe('OVERDUE');
      expect(items[1].warrantyRelease?.level).toBe('DUE_SOON');
      expect(items[2].immobilization).toMatchObject({ pendingDays: 2, suggestedAmount: 240 });
    });

    it('filtra por tipo y consulta candidatos desde el umbral mínimo (20 h garantía / 24 h inmovilización)', async () => {
      const { deps, handler } = build();
      await handler.execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1'));
      expect(deps.alerts.listCandidates).toHaveBeenLastCalledWith({ ...TEST_SCOPE, receivedBefore: hoursBeforeNow(20), includeLateCharge: true, limit: 100 });

      await handler.execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1', 'IMMOBILIZATION', 5));
      expect(deps.alerts.listCandidates).toHaveBeenLastCalledWith({ ...TEST_SCOPE, receivedBefore: hoursBeforeNow(24), includeLateCharge: false, limit: 5 });

      deps.alerts.listCandidates.mockResolvedValue([
        buildReturnRecord({ id: 'r-overdue', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(25) }),
      ]);
      expect(await handler.execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1', 'IMMOBILIZATION'))).toEqual([]);
    });

    it('LATE_CHARGE (DEC-DEVREM-003): sugiere registrar el cargo por retraso sin monto; solo pide candidatas por retraso (sin alertas de reloj)', async () => {
      const { deps, handler } = build();
      const scheduledAt = hoursBeforeNow(3);
      deps.alerts.listCandidates.mockResolvedValue([
        buildReturnRecord({ id: 'r-late', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 45 * 60_000) }),
        buildReturnRecord({ id: 'r-tolerance', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 30 * 60_000) }),
        buildReturnRecord({ id: 'r-registered', status: 'INSPECCION', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 90 * 60_000), lateChargeAmount: 50 }),
        buildReturnRecord({ id: 'r-closed', status: 'CERRADA', scheduledAt, receivedAt: new Date(scheduledAt.getTime() + 90 * 60_000) }),
      ]);

      const items = await handler.execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1', 'LATE_CHARGE'));

      expect(deps.alerts.listCandidates).toHaveBeenLastCalledWith({ ...TEST_SCOPE, receivedBefore: null, includeLateCharge: true, limit: 100 });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ returnId: 'r-late', type: 'LATE_CHARGE', warrantyRelease: null, immobilization: null });
      expect(items[0].lateCharge).toEqual({ lateMinutes: 45, lateToleranceMinutes: 30 });
      expect(JSON.stringify(items[0])).not.toMatch(/amount|monto|suggestedTimeCharge/i);
    });

    it('rol sin lectura (RRHH) -> 403', async () => {
      const deps = buildDeps({ role: 'RRHH' });
      await expect(
        new ListReturnAlertsHandler(deps.access, deps.alerts, deps.clock).execute(new ListReturnAlertsQuery('uid-1', 'comp-1', 'branch-1')),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
