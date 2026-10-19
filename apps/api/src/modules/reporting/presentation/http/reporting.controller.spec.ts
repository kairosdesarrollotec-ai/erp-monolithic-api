import { ReportingController } from './reporting.controller';

/**
 * Filtros dateFrom/dateTo en el controlador (reporting 0.4.0, DEC-TZ-LIMA-001):
 * date-only → dateFrom 00:00 Lima, dateTo fin del día Lima (inclusivo).
 */
function build() {
  const getOperationalKpis = { execute: jest.fn().mockResolvedValue({}) };
  const getFinancialKpis = { execute: jest.fn().mockResolvedValue({}) };
  const exportReport = { execute: jest.fn().mockResolvedValue({ csv: 'a', filename: 'f.csv' }) };
  const controller = new ReportingController(getOperationalKpis as any, getFinancialKpis as any, exportReport as any);
  const req = { firebaseUid: 'uid-1' } as any;
  return { controller, req, getOperationalKpis, getFinancialKpis, exportReport };
}

const COMPANY = '11111111-1111-4111-8111-111111111111';
const BRANCH = '22222222-2222-4222-8222-222222222222';

describe('ReportingController — filtros de fecha', () => {
  it('financial: dateTo date-only incluye todo el día de Lima', async () => {
    const { controller, req, getFinancialKpis } = build();
    await controller.financial(req, { companyId: COMPANY, branchId: BRANCH, dateFrom: '2026-10-01', dateTo: '2026-10-11' });
    const q = getFinancialKpis.execute.mock.calls[0][0];
    expect(q.dateFrom.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(q.dateTo.toISOString()).toBe('2026-10-12T04:59:59.999Z');
  });

  it('operational: sin filtros usa el día de hoy en Lima', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T02:00:00.000Z')); // 15-oct 21:00 Lima
    try {
      const { controller, req, getOperationalKpis } = build();
      await controller.operational(req, { companyId: COMPANY, branchId: BRANCH });
      const q = getOperationalKpis.execute.mock.calls[0][0];
      expect(q.dateFrom.toISOString()).toBe('2026-10-15T05:00:00.000Z');
      expect(q.dateTo.toISOString()).toBe('2026-10-16T04:59:59.999Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('operational: fecha inexistente → INVALID_DATE 400 sin invocar al handler', async () => {
    const { controller, req, getOperationalKpis } = build();
    await expect(
      controller.operational(req, { companyId: COMPANY, branchId: BRANCH, dateFrom: '2026-02-30', dateTo: '2026-03-01' }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE', httpStatus: 400 });
    expect(getOperationalKpis.execute).not.toHaveBeenCalled();
  });

  it('export: pasa el período inclusivo y el tipo por defecto combined; el CSV usa Content-Disposition', async () => {
    const { controller, req, exportReport } = build();
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;
    await controller.export(req, { companyId: COMPANY, branchId: BRANCH, dateFrom: '2026-10-01', dateTo: '2026-10-11' }, res);
    const q = exportReport.execute.mock.calls[0][0];
    expect(q.dateFrom.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(q.dateTo.toISOString()).toBe('2026-10-12T04:59:59.999Z');
    expect(q.type).toBe('combined');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="f.csv"');
  });
});
