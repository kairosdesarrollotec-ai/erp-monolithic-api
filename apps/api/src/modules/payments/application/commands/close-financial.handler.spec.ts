import { ForbiddenException } from '@nestjs/common';
import { CloseFinancialHandler } from './close-financial.handler';
import { CloseFinancialCommand } from './close-financial.command';
import { DepositInTerminalStateError, DepositNotFoundError } from '../../domain/deposit-errors';
import { buildDeps, buildDeposit } from '../../testing/payment-test-fixtures';

describe('CloseFinancialHandler (PAG-P05 / UC-PAG-005)', () => {
  it.each([
    { retained: 0, expectedStatus: 'RETURNED' as const },
    { retained: 150, expectedStatus: 'PARTIALLY_RETAINED' as const },
    { retained: 500, expectedStatus: 'RETAINED' as const },
  ])('calcula el estado final correctamente (retained=$retained → $expectedStatus)', async ({ retained, expectedStatus }) => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const deposit = buildDeposit({ originalAmount: 500, status: 'HELD' });
    const closedDeposit = { ...deposit, status: expectedStatus, closedAt: new Date(), closureNotes: 'Cierre' };
    deps.deposits.findById.mockResolvedValueOnce(deposit).mockResolvedValueOnce(closedDeposit);
    deps.deposits.updateStatus.mockResolvedValue(undefined);

    const handler = new CloseFinancialHandler(deps.access, deps.deposits, deps.auditRepository);
    const result = await handler.execute(
      new CloseFinancialCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1', retained, 'Cierre financiero confirmado'),
    );

    expect(deps.deposits.updateStatus).toHaveBeenCalledWith(deposit.id, expectedStatus, expect.any(Date), 'Cierre financiero confirmado');
    expect(result.status).toBe(expectedStatus);
  });

  it('lanza DepositInTerminalStateError para garantia ya cerrada', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const deposit = buildDeposit({ status: 'RETAINED' });
    deps.deposits.findById.mockResolvedValue(deposit);

    const handler = new CloseFinancialHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new CloseFinancialCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1', 500, 'Notas')),
    ).rejects.toThrow(DepositInTerminalStateError);
  });

  it('lanza DepositNotFoundError para deposito de otra empresa (INV-PAG-005)', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    deps.deposits.findById.mockResolvedValue(null);

    const handler = new CloseFinancialHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new CloseFinancialCommand('dep-other', 'uid-1', 'comp-1', 'branch-1', 100, 'Notas')),
    ).rejects.toThrow(DepositNotFoundError);
  });

  it('lanza ForbiddenException cuando el rol no tiene permiso CLOSE_FINANCIAL (BR-PAG-007)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });

    const handler = new CloseFinancialHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new CloseFinancialCommand('dep-1', 'uid-1', 'comp-1', 'branch-1', 100, 'Notas')),
    ).rejects.toThrow(ForbiddenException);
  });
});
