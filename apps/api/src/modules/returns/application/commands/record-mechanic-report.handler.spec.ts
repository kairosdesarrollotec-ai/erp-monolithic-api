import { RecordMechanicReportHandler } from './record-mechanic-report.handler';
import { RecordMechanicReportCommand } from './record-mechanic-report.command';
import { ReturnNotFoundError } from '../../domain/return-errors';
import {
  applyUpdate,
  buildDeps,
  buildReturnRecord,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';

describe('RecordMechanicReportHandler (DEC-DEV-REPORT-001)', () => {
  function build(overrides: Partial<ReturnRecord> = {}) {
    const deps = buildDeps({ role: 'GERENCIA' });
    const base = buildReturnRecord({
      status: 'CON_DANOS',
      version: 5,
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const handler = new RecordMechanicReportHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
    );
    return { deps, handler, base };
  }

  it('registra la aceptación del informe mecánico por el cliente y audita el evento', async () => {
    const { deps, handler } = build();
    const cmd = new RecordMechanicReportCommand(
      'ret-1',
      'user-1',
      'comp-1',
      'branch-1',
      5,
      true,
      'Cliente acepta informe de taller Motrix',
    );

    const result = await handler.execute(cmd);

    expect(result.mechanicReportAccepted).toBe(true);
    expect(result.mechanicReportNotes).toBe('Cliente acepta informe de taller Motrix');
    expect(result.mechanicReportAcceptedBy).toBe('user-1');
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_MECHANIC_REPORT_RECORDED',
      }),
      expect.anything(),
    );
  });

  it('si el expediente no existe lanza ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RecordMechanicReportCommand('bad-id', 'user-1', 'comp-1', 'branch-1', 1, true)),
    ).rejects.toThrow(ReturnNotFoundError);
  });
});
