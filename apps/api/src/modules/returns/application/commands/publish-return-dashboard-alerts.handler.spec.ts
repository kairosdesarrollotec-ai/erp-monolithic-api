import { DASHBOARD_ALERT_PAGE_SIZE, PublishReturnDashboardAlertsHandler } from './publish-return-dashboard-alerts.handler';
import { ReturnDashboardAlertPort } from '../ports/return-dashboard-alert.port';
import { buildReturnRecord, FIXED_NOW, FixedClock } from '../../testing/return-test-fixtures';

const hoursBeforeNow = (h: number): Date => new Date(FIXED_NOW.getTime() - h * 3_600_000);

function build() {
  const port = {
    listWarrantyCandidates: jest.fn().mockResolvedValue([]),
    createDashboardItems: jest.fn().mockResolvedValue(0),
    listActiveWarrantyItems: jest.fn().mockResolvedValue([]),
    findReturnsByIds: jest.fn().mockResolvedValue([]),
    dismissItems: jest.fn().mockResolvedValue(0),
  };
  const handler = new PublishReturnDashboardAlertsHandler(port as unknown as ReturnDashboardAlertPort, new FixedClock(FIXED_NOW));
  return { port, handler };
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
      { id: 'i1', sourceId: 'ok', sourceEventId: 'return-warranty:OVERDUE:ok' }, // sigue vencida: se conserva
      { id: 'i2', sourceId: 'closed', sourceEventId: 'return-warranty:DUE_SOON:closed' }, // CIERRE_FINANCIERO
      { id: 'i3', sourceId: 'esc', sourceEventId: 'return-warranty:DUE_SOON:esc' }, // pasó a OVERDUE
      { id: 'i4', sourceId: 'gone', sourceEventId: 'return-warranty:OVERDUE:gone' }, // ya no existe
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
});
