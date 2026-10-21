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
});
