import { DASHBOARD_ALERT_PAGE_SIZE, PublishReturnDashboardAlertsHandler } from './publish-return-dashboard-alerts.handler';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { ReturnAlertRecipientsPort } from '../ports/return-alert-recipients.port';
import type { WorkerRole } from '../../../users/domain/worker-role';
import { buildReturnRecord, FIXED_NOW, FixedClock } from '../../testing/return-test-fixtures';

const SCOPE = { role: 'FINANZAS' as WorkerRole, organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'br-1' };
const hoursBeforeNow = (h: number): Date => new Date(FIXED_NOW.getTime() - h * 3_600_000);

function build(recipientRoles: WorkerRole[] = ['FINANZAS']) {
  const recipients = { rolesWithAlertPermission: jest.fn().mockResolvedValue(recipientRoles) };
  const port = {
    listWarrantyCandidates: jest.fn().mockResolvedValue([]),
    createDashboardItems: jest.fn().mockResolvedValue(0),
    listActiveWarrantyItems: jest.fn().mockResolvedValue([]),
    listActiveItems: jest.fn().mockResolvedValue([]),
    listLateChargeCandidates: jest.fn().mockResolvedValue([]),
    listImmobilizationCandidates: jest.fn().mockResolvedValue([]),
    findReturnsByIds: jest.fn().mockResolvedValue([]),
    dismissItems: jest.fn().mockResolvedValue(0),
  };
  const handler = new PublishReturnDashboardAlertsHandler(
    port as unknown as ReturnDashboardAlertPort,
    new FixedClock(FIXED_NOW),
    recipients as unknown as ReturnAlertRecipientsPort,
  );
  return { port, handler, recipients };
}

describe('PublishReturnDashboardAlertsHandler (BR-DEV-001 / DEC-DEVREM-002)', () => {
  it('pide candidatas recibidas hace ≥ 20 h (24 h - 4 h de aviso) y crea un item por devolución en alerta', async () => {
    const { port, handler } = build();
    port.listWarrantyCandidates.mockResolvedValue([
      buildReturnRecord({ id: 'a', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(21) }), // DUE_SOON
      buildReturnRecord({ id: 'b', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(30) }), // OVERDUE
      buildReturnRecord({ id: 'c', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(10) }), // aún no
      buildReturnRecord({ id: 'd', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(30), depositRequired: false }), // sin garantía
    ]);
    port.createDashboardItems.mockResolvedValue(2);

    const result = await handler.execute();

    expect(port.listWarrantyCandidates).toHaveBeenCalledWith(hoursBeforeNow(20), DASHBOARD_ALERT_PAGE_SIZE, undefined);
    const items = port.createDashboardItems.mock.calls[0][0];
    expect(items.map((i: { sourceEventId: string }) => i.sourceEventId)).toEqual(['return-warranty:DUE_SOON:a', 'return-warranty:OVERDUE:b']);
    expect(items.every((i: { role: string }) => i.role === 'FINANZAS')).toBe(true);
    expect(result).toEqual({ candidates: 4, created: 2, dismissed: 0 });
  });

  it('idempotente: correr dos veces reenvía las MISMAS claves naturales (la base descarta los duplicados)', async () => {
    const { port, handler } = build();
    port.listWarrantyCandidates.mockResolvedValue([buildReturnRecord({ id: 'a', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(22) })]);
    port.createDashboardItems.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const first = await handler.execute();
    const second = await handler.execute();
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(port.createDashboardItems.mock.calls[0][0]).toEqual(port.createDashboardItems.mock.calls[1][0]);
  });

  it('pagina por id hasta agotar las candidatas', async () => {
    const { port, handler } = build();
    const full = Array.from({ length: DASHBOARD_ALERT_PAGE_SIZE }, (_, i) =>
      buildReturnRecord({ id: `r-${String(i).padStart(4, '0')}`, status: 'SIN_DANOS', receivedAt: hoursBeforeNow(5) }),
    );
    port.listWarrantyCandidates.mockResolvedValueOnce(full).mockResolvedValueOnce([buildReturnRecord({ id: 'z', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(5) })]);
    const result = await handler.execute();
    expect(port.listWarrantyCandidates).toHaveBeenCalledTimes(2);
    expect(port.listWarrantyCandidates.mock.calls[1][2]).toBe(full[full.length - 1].id);
    expect(result.candidates).toBe(DASHBOARD_ALERT_PAGE_SIZE + 1);
  });

  it('reconcilia: descarta items cuya devolución ya no está en alerta (cerró, tuvo daños, falta, o pasó a OVERDUE)', async () => {
    const { port, handler } = build();
    port.listActiveWarrantyItems.mockResolvedValue([
      { ...SCOPE, id: 'i1', sourceId: 'ok', sourceEventId: 'return-warranty:OVERDUE:ok' }, // sigue vencida: se conserva
      { ...SCOPE, id: 'i2', sourceId: 'closed', sourceEventId: 'return-warranty:DUE_SOON:closed' }, // CIERRE_FINANCIERO
      { ...SCOPE, id: 'i3', sourceId: 'esc', sourceEventId: 'return-warranty:DUE_SOON:esc' }, // pasó a OVERDUE
      { ...SCOPE, id: 'i4', sourceId: 'gone', sourceEventId: 'return-warranty:OVERDUE:gone' }, // ya no existe
    ]);
    port.findReturnsByIds.mockResolvedValue([
      buildReturnRecord({ id: 'ok', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(30) }),
      buildReturnRecord({ id: 'closed', status: 'CIERRE_FINANCIERO', receivedAt: hoursBeforeNow(21) }),
      buildReturnRecord({ id: 'esc', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(26) }),
    ]);
    port.dismissItems.mockResolvedValue(3);

    const result = await handler.execute();

    expect(port.dismissItems).toHaveBeenCalledWith(['i2', 'i3', 'i4'], FIXED_NOW);
    expect(result.dismissed).toBe(3);
  });

  it('sin nada que hacer no escribe', async () => {
    const { port, handler } = build();
    const result = await handler.execute();
    expect(result).toEqual({ candidates: 0, created: 0, dismissed: 0 });
    expect(port.createDashboardItems).not.toHaveBeenCalled();
  });

  describe('destinatarios por permiso NOTIFICATIONS.RECEIVE_RETURN_ALERTS (Respuestas 2026-10-20 #8)', () => {
    const received = (h: number, id = 'a') => buildReturnRecord({ id, status: 'SIN_DANOS', receivedAt: hoursBeforeNow(h) });

    it('crea un item por rol con el permiso (no solo FINANZAS), con clave natural distinta por rol', async () => {
      const { port, handler } = build(['ADMINISTRACION', 'FINANZAS', 'GERENCIA']);
      port.listWarrantyCandidates.mockResolvedValue([received(21)]);
      await handler.execute();
      const items = port.createDashboardItems.mock.calls[0][0];
      expect(items.map((i: { role: string }) => i.role)).toEqual(['ADMINISTRACION', 'FINANZAS', 'GERENCIA']);
      expect(items.map((i: { sourceEventId: string }) => i.sourceEventId)).toEqual([
        'return-warranty:DUE_SOON:a:ADMINISTRACION',
        'return-warranty:DUE_SOON:a', // FINANZAS conserva la clave historica (sin duplicar lo ya publicado)
        'return-warranty:DUE_SOON:a:GERENCIA',
      ]);
    });

    it('filtra por la empresa/sede de CADA devolucion y resuelve una vez por alcance en el ciclo', async () => {
      const { port, handler, recipients } = build();
      recipients.rolesWithAlertPermission.mockImplementation(async (scope: { branchId: string }) => (scope.branchId === 'br-A' ? ['GERENCIA'] : ['FINANZAS']));
      port.listWarrantyCandidates.mockResolvedValue([
        { ...received(21, 'a'), branchId: 'br-A' },
        { ...received(22, 'b'), branchId: 'br-A' },
        { ...received(23, 'c'), branchId: 'br-B' },
      ]);
      await handler.execute();
      const items = port.createDashboardItems.mock.calls[0][0] as Array<{ role: string; sourceId: string; branchId: string }>;
      expect(items.map((i) => [i.sourceId, i.role, i.branchId])).toEqual([
        ['a', 'GERENCIA', 'br-A'],
        ['b', 'GERENCIA', 'br-A'],
        ['c', 'FINANZAS', 'br-B'],
      ]);
      expect(recipients.rolesWithAlertPermission).toHaveBeenCalledTimes(2);
    });

    it('si ningun rol tiene el permiso en ese alcance, no se crea ningun item', async () => {
      const { port, handler } = build([]);
      port.listWarrantyCandidates.mockResolvedValue([received(21)]);
      await handler.execute();
      expect(port.createDashboardItems).toHaveBeenCalledWith([]);
    });

    it('reconcilia: descarta el item de un rol que perdio el permiso aunque la alerta siga vigente', async () => {
      const { port, handler } = build(['FINANZAS']);
      port.listActiveWarrantyItems.mockResolvedValue([
        { ...SCOPE, id: 'keep', sourceId: 'x', sourceEventId: 'return-warranty:OVERDUE:x' },
        { ...SCOPE, role: 'GERENCIA', id: 'lost', sourceId: 'x', sourceEventId: 'return-warranty:OVERDUE:x:GERENCIA' },
      ]);
      port.findReturnsByIds.mockResolvedValue([buildReturnRecord({ id: 'x', status: 'SIN_DANOS', receivedAt: hoursBeforeNow(30) })]);
      await handler.execute();
      expect(port.dismissItems).toHaveBeenCalledWith(['lost'], FIXED_NOW);
    });
  });

  describe('P3: cargo por retraso e inmovilizacion al tablero (Respuestas 2026-10-20 #7-#9)', () => {
    const late = (over: Record<string, unknown> = {}) =>
      buildReturnRecord({ id: 'l1', status: 'INSPECCION', scheduledAt: hoursBeforeNow(5), receivedAt: hoursBeforeNow(3), lateChargeAmount: null, ...over });
    const immo = (over: Record<string, unknown> = {}) =>
      buildReturnRecord({
        id: 'm1',
        status: 'CON_DANOS',
        receivedAt: hoursBeforeNow(50),
        vehicleDailyRate: 100,
        damages: [{ origin: 'TECHNICAL' }] as never,
        immobilizationCharges: [],
        ...over,
      });

    it('LATE_CHARGE: un item por rol destinatario, clave con sufijo de rol, sin monto y sin datos del cliente', async () => {
      const { port, handler } = build(['FINANZAS', 'GERENCIA']);
      port.listLateChargeCandidates.mockResolvedValue([late(), late({ id: 'l2', receivedAt: hoursBeforeNow(4.9) })]); // l2: 6 min tarde < tolerancia
      port.createDashboardItems.mockResolvedValue(2);
      const result = await handler.execute();
      expect(port.listLateChargeCandidates).toHaveBeenCalledWith(FIXED_NOW, DASHBOARD_ALERT_PAGE_SIZE, undefined);
      const items = port.createDashboardItems.mock.calls[0][0] as Array<{ sourceEventId: string; role: string; title: string; detail: string; priority: number }>;
      expect(items.map((i) => i.sourceEventId)).toEqual(['return-late-charge:l1:FINANZAS', 'return-late-charge:l1:GERENCIA']);
      expect(items[0].detail).toContain('120 min');
      expect(items[0].detail).not.toMatch(/S\//);
      expect(result.created).toBe(2);
    });

    it('LATE_CHARGE: idempotente (mismas claves en dos ciclos)', async () => {
      const { port, handler } = build();
      port.listLateChargeCandidates.mockResolvedValue([late()]);
      await handler.execute();
      await handler.execute();
      expect(port.createDashboardItems.mock.calls[0][0]).toEqual(port.createDashboardItems.mock.calls[1][0]);
    });

    it('IMMOBILIZATION: pide recibidas hace >= 24 h y publica solo con dano tecnico y dias pendientes', async () => {
      const { port, handler } = build(['ADMINISTRACION']);
      port.listImmobilizationCandidates.mockResolvedValue([
        immo(),
        immo({ id: 'm2', damages: [{ origin: 'THIRD_PARTY' }] as never }), // sin dano tecnico
        immo({ id: 'm3', immobilizationCharges: [{ daysCharged: 5 }] as never }), // ya cobrado
      ]);
      await handler.execute();
      expect(port.listImmobilizationCandidates).toHaveBeenCalledWith(hoursBeforeNow(24), DASHBOARD_ALERT_PAGE_SIZE, undefined);
      const items = port.createDashboardItems.mock.calls[0][0] as Array<{ sourceEventId: string; role: string; priority: number; detail: string }>;
      expect(items.map((i) => i.sourceEventId)).toEqual(['return-immobilization:m1:ADMINISTRACION']);
      expect(items[0].priority).toBeGreaterThan(60);
      expect(items[0].detail).toContain('cobro es manual');
    });

    it('reconcilia LATE_CHARGE: descarta al registrarse el cargo, al cerrar la devolucion o si el rol pierde el permiso', async () => {
      const { port, handler } = build(['FINANZAS']);
      port.listActiveItems.mockImplementation(async (prefix: string) =>
        prefix === 'return-late-charge:'
          ? [
              { ...SCOPE, id: 'keep', sourceId: 'l1', sourceEventId: 'return-late-charge:l1:FINANZAS' },
              { ...SCOPE, id: 'charged', sourceId: 'l2', sourceEventId: 'return-late-charge:l2:FINANZAS' },
              { ...SCOPE, id: 'closed', sourceId: 'l3', sourceEventId: 'return-late-charge:l3:FINANZAS' },
              { ...SCOPE, role: 'GERENCIA' as WorkerRole, id: 'lost', sourceId: 'l1', sourceEventId: 'return-late-charge:l1:GERENCIA' },
            ]
          : [],
      );
      port.findReturnsByIds.mockResolvedValue([late(), late({ id: 'l2', lateChargeAmount: 40 }), late({ id: 'l3', status: 'CERRADA' })]);
      port.dismissItems.mockResolvedValue(3);
      await handler.execute();
      expect(port.dismissItems).toHaveBeenCalledWith(['charged', 'closed', 'lost'], FIXED_NOW);
    });

    it('reconcilia IMMOBILIZATION: se descarta cuando los dias pendientes ya fueron cobrados', async () => {
      const { port, handler } = build(['FINANZAS']);
      port.listActiveItems.mockImplementation(async (prefix: string) =>
        prefix === 'return-immobilization:'
          ? [
              { ...SCOPE, id: 'keep', sourceId: 'm1', sourceEventId: 'return-immobilization:m1:FINANZAS' },
              { ...SCOPE, id: 'paid', sourceId: 'm2', sourceEventId: 'return-immobilization:m2:FINANZAS' },
            ]
          : [],
      );
      port.findReturnsByIds.mockResolvedValue([immo(), immo({ id: 'm2', immobilizationCharges: [{ daysCharged: 5 }] as never })]);
      port.dismissItems.mockResolvedValue(1);
      await handler.execute();
      expect(port.dismissItems).toHaveBeenCalledWith(['paid'], FIXED_NOW);
    });
  });
});
