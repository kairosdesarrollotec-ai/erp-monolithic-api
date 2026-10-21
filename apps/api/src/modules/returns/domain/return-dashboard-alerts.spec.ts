import { computeWarrantyReleaseAlert } from './return-alerts';
import {
  WARRANTY_DASHBOARD_PRIORITY,
  buildWarrantyDashboardItem,
  parseWarrantyDashboardLevel,
  warrantyDashboardKey,
} from './return-dashboard-alerts';

const subject = { id: 'ret-1', organizationId: 'org-1', operatingCompanyId: 'comp-1', branchId: 'br-1', vehiclePlate: 'ABC-123' };
const RECEIVED = new Date('2026-10-05T14:00:00.000Z'); // 09:00 Lima
const at = (hours: number) => new Date(RECEIVED.getTime() + hours * 3_600_000);
const sinDanos = { status: 'SIN_DANOS' as const, receivedAt: RECEIVED, vehicleDailyRate: null };

describe('alerta de garantía 24 h en el tablero (DEC-DEVREM-002)', () => {
  it('DUE_SOON: item ALERT para Finanzas, hora de Lima, deep link a la garantía y clave natural por nivel', () => {
    const alert = computeWarrantyReleaseAlert(sinDanos, at(21))!;
    const item = buildWarrantyDashboardItem(subject, alert);
    expect(item).toMatchObject({
      role: 'FINANZAS',
      itemType: 'ALERT',
      priority: WARRANTY_DASHBOARD_PRIORITY.DUE_SOON,
      sourceType: 'RETURN',
      sourceId: 'ret-1',
      sourceEventId: 'return-warranty:DUE_SOON:ret-1',
      deepLink: '/devoluciones/ret-1/garantia',
      detail: 'Vehículo ABC-123',
    });
    // límite = recepción + 24 h = 06/10/2026 09:00 Lima
    expect(item.title).toContain('06/10/2026 09:00');
    expect(item.title).toContain('hora de Lima');
  });

  it('OVERDUE tiene más prioridad que DUE_SOON y otra clave (se publica una vez por nivel)', () => {
    const due = buildWarrantyDashboardItem(subject, computeWarrantyReleaseAlert(sinDanos, at(21))!);
    const over = buildWarrantyDashboardItem(subject, computeWarrantyReleaseAlert(sinDanos, at(25))!);
    expect(over.priority).toBeGreaterThan(due.priority);
    expect(over.sourceEventId).toBe('return-warranty:OVERDUE:ret-1');
    expect(over.title).toMatch(/vencida/i);
  });

  it('no incluye datos personales del cliente (solo la placa) y la placa ausente deja detail en null', () => {
    const item = buildWarrantyDashboardItem({ ...subject, vehiclePlate: null }, computeWarrantyReleaseAlert(sinDanos, at(22))!);
    expect(item.detail).toBeNull();
    expect(JSON.stringify(item)).not.toMatch(/cliente|customer|Juan/i);
  });

  it('parseWarrantyDashboardLevel recupera el nivel de la clave y rechaza claves ajenas', () => {
    expect(parseWarrantyDashboardLevel(warrantyDashboardKey('DUE_SOON', 'x'))).toBe('DUE_SOON');
    expect(parseWarrantyDashboardLevel(warrantyDashboardKey('OVERDUE', 'x'))).toBe('OVERDUE');
    expect(parseWarrantyDashboardLevel('return-warranty:OTRO:x')).toBeNull();
    expect(parseWarrantyDashboardLevel('RESERVATION:abc')).toBeNull();
  });
});
