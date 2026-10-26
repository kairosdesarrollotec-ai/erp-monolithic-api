import { EscalateLegalHandler } from './escalate-legal.handler';
import { EscalateLegalCommand } from './escalate-legal.command';
import { ReturnNotFoundError } from '../../domain/return-errors';
import {
  applyUpdate,
  buildDeps,
  buildReturnRecord,
} from '../../testing/return-test-fixtures';
import { ReturnRecord } from '../ports/return-repository.port';

describe('EscalateLegalHandler (DEC-DEV-LEGAL-001)', () => {
  function build(overrides: Partial<ReturnRecord> = {}) {
    const deps = buildDeps({ role: 'GERENCIA' });
    const base = buildReturnRecord({
      status: 'CON_DANOS',
      version: 5,
      ...overrides,
    });
    deps.returns.findById.mockResolvedValue(base);
    deps.returns.update.mockImplementation(async (input) => applyUpdate(base, input));
    const handler = new EscalateLegalHandler(
      deps.access,
      deps.returns,
      deps.transactionManager,
      deps.clock,
      deps.auditRepository,
      deps.outboxRepository,
    );
    return { deps, handler, base };
  }

  it('registra la derivación a legal, audita y publica evento outbox', async () => {
    const { deps, handler } = build();
    const cmd = new EscalateLegalCommand(
      'ret-1',
      'user-1',
      'comp-1',
      'branch-1',
      5,
      'Cliente rechaza conciliar; caso derivado al área legal',
    );

    const result = await handler.execute(cmd);

    expect(result.legalEscalated).toBe(true);
    expect(result.legalNotes).toBe('Cliente rechaza conciliar; caso derivado al área legal');
    expect(result.legalEscalatedBy).toBe('user-1');
    expect(deps.auditRepository.recordRentalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_LEGAL_ESCALATED',
      }),
      expect.anything(),
    );
    expect(deps.outboxRepository.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DevolucionEscaladaLegal.v1',
      }),
      expect.anything(),
    );
  });

  it('si la devolución no existe lanza ReturnNotFoundError', async () => {
    const { deps, handler } = build();
    deps.returns.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new EscalateLegalCommand('bad-id', 'user-1', 'comp-1', 'branch-1', 1, 'notas')),
    ).rejects.toThrow(ReturnNotFoundError);
  });
});
