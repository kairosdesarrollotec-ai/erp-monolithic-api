import { ForbiddenException } from '@nestjs/common';
import { ApproveRefundHandler } from './approve-refund.handler';
import { ApproveRefundCommand } from './approve-refund.command';
import { DepositInTerminalStateError, DepositNotFoundError, PendingDamageResolutionError } from '../../domain/deposit-errors';
import { buildDeps, buildDeposit } from '../../testing/payment-test-fixtures';

describe('ApproveRefundHandler (PAG-P04 / UC-PAG-004)', () => {
  it('aprueba la devolucion y retorna el deposito actualizado cuando no hay FULL_RETENTION', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const deposit = buildDeposit({ adjustments: [] });
    deps.deposits.findById.mockResolvedValueOnce(deposit).mockResolvedValueOnce({ ...deposit, status: 'RETURNED' });
    deps.deposits.updateStatus.mockResolvedValue(undefined);

    const handler = new ApproveRefundHandler(deps.access, deps.deposits, deps.auditRepository);
    const result = await handler.execute(new ApproveRefundCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1'));

    expect(deps.deposits.updateStatus).toHaveBeenCalledWith(deposit.id, 'RETURNED');
    expect(result.status).toBe('RETURNED');
  });

  it('lanza PendingDamageResolutionError cuando existe ajuste FULL_RETENTION (BR-PAG-005)', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const deposit = buildDeposit({ adjustments: [{ amount: 500, type: 'FULL_RETENTION' }] });
    deps.deposits.findById.mockResolvedValue(deposit);

    const handler = new ApproveRefundHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new ApproveRefundCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(PendingDamageResolutionError);

    expect(deps.deposits.updateStatus).not.toHaveBeenCalled();
  });

  it('lanza DepositInTerminalStateError para garantia ya en estado terminal', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    const deposit = buildDeposit({ status: 'RETURNED' });
    deps.deposits.findById.mockResolvedValue(deposit);

    const handler = new ApproveRefundHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new ApproveRefundCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(DepositInTerminalStateError);
  });

  it('lanza DepositNotFoundError para deposito de otra empresa (INV-PAG-005)', async () => {
    const deps = buildDeps({ role: 'FINANZAS' });
    deps.deposits.findById.mockResolvedValue(null);

    const handler = new ApproveRefundHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new ApproveRefundCommand('dep-other', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(DepositNotFoundError);
  });

  it('lanza ForbiddenException cuando el rol no tiene permiso APPROVE_REFUND (BR-PAG-007)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });

    const handler = new ApproveRefundHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new ApproveRefundCommand('dep-1', 'uid-1', 'comp-1', 'branch-1')),
    ).rejects.toThrow(ForbiddenException);
  });
});
