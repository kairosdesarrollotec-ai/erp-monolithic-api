import { GetFinancialKpisHandler } from './get-financial-kpis.handler';
import { GetFinancialKpisQuery } from './get-financial-kpis.query';
import { ExportReportHandler } from './export-report.handler';
import { ExportReportQuery } from './export-report.query';
import { resolveReportPeriod } from './reporting.utils';

/**
 * Los handlers financiero y de exportación filtran el período con [dateFrom, dateTo] inclusivo
 * (dateTo = fin del día Lima) y devuelven fechas de Lima; rechazan >90 días con RANGE_EXCEEDS_MAX.
 */
function mocks() {
  const agg = jest.fn().mockResolvedValue({ _sum: { originalAmount: 0, amount: 0 } });
  const prisma = {
    rentalDeposit: { aggregate: agg },
    rentalDepositAdjustment: { aggregate: agg },
    rental: { count: jest.fn().mockResolvedValue(0) },
    reservation: { count: jest.fn().mockResolvedValue(0) },
    rentalReturn: { count: jest.fn().mockResolvedValue(0) },
    vehicle: { count: jest.fn().mockResolvedValue(0) },
    incident: { count: jest.fn().mockResolvedValue(0) },
  };
  const workContext = {
    authorize: jest.fn().mockResolvedValue({ organizationId: 'org', companyId: 'c1', branchId: 'b1', roleId: 'r' }),
  };
  const matrixAuth = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
  return { prisma, workContext, matrixAuth };
}

describe('GetFinancialKpisHandler — período', () => {
  it('usa dateTo = 23:59:59.999 Lima en los filtros lte y devuelve fechas de Lima', async () => {
    const { prisma, workContext, matrixAuth } = mocks();
    const handler = new GetFinancialKpisHandler(workContext as any, matrixAuth as any, prisma as any);
    const { dateFrom, dateTo } = resolveReportPeriod({ dateFrom: '2026-10-01', dateTo: '2026-10-11' });
    const res = await handler.execute(new GetFinancialKpisQuery('uid', 'c1', 'b1', dateFrom, dateTo));

    expect(res.dateFrom).toBe('2026-10-01');
    expect(res.dateTo).toBe('2026-10-11');
    const releaseCall = prisma.rentalDepositAdjustment.aggregate.mock.calls.find(
      ([a]: any[]) => a.where.type === 'RELEASE',
    )!;
    expect(releaseCall[0].where.createdAt).toEqual({
      gte: new Date('2026-10-01T05:00:00.000Z'),
      lte: new Date('2026-10-12T04:59:59.999Z'),
    });
  });

  it('rechaza más de 90 días con RANGE_EXCEEDS_MAX sin consultar la base', async () => {
    const { prisma, workContext, matrixAuth } = mocks();
    const handler = new GetFinancialKpisHandler(workContext as any, matrixAuth as any, prisma as any);
    const { dateFrom, dateTo } = resolveReportPeriod({ dateFrom: '2026-01-01', dateTo: '2026-04-02' });
    await expect(handler.execute(new GetFinancialKpisQuery('uid', 'c1', 'b1', dateFrom, dateTo))).rejects.toMatchObject({
      code: 'RANGE_EXCEEDS_MAX',
      httpStatus: 400,
    });
    expect(prisma.rentalDeposit.aggregate).not.toHaveBeenCalled();
    expect(workContext.authorize).not.toHaveBeenCalled();
  });
});

describe('ExportReportHandler — período', () => {
  it('nombra el archivo y el periodo con los días de Lima del rango', async () => {
    const { prisma, workContext, matrixAuth } = mocks();
    const handler = new ExportReportHandler(workContext as any, matrixAuth as any, prisma as any);
    const { dateFrom, dateTo } = resolveReportPeriod({ dateFrom: '2026-10-01', dateTo: '2026-10-11' });
    const res = await handler.execute(new ExportReportQuery('uid', 'c1', 'b1', dateFrom, dateTo, 'combined'));

    expect(res.filename).toBe('reporte-2026-10-01_2026-10-11.csv');
    expect(res.csv).toContain('"2026-10-01_2026-10-11"');
  });

  it('rechaza dateFrom posterior a dateTo con INVALID_DATE_RANGE', async () => {
    const { prisma, workContext, matrixAuth } = mocks();
    const handler = new ExportReportHandler(workContext as any, matrixAuth as any, prisma as any);
    const { dateFrom } = resolveReportPeriod({ dateFrom: '2026-10-12', dateTo: '2026-10-12' });
    const { dateTo } = resolveReportPeriod({ dateFrom: '2026-10-11', dateTo: '2026-10-11' });
    await expect(handler.execute(new ExportReportQuery('uid', 'c1', 'b1', dateFrom, dateTo, 'combined'))).rejects.toMatchObject({
      code: 'INVALID_DATE_RANGE',
    });
  });
});
