import { ForbiddenException } from '@nestjs/common';
import { RegisterAdjustmentHandler } from './register-adjustment.handler';
import { RegisterAdjustmentCommand } from './register-adjustment.command';
import { AdjustmentAmountExceedsDepositError, DepositInTerminalStateError, DepositNotFoundError } from '../../domain/deposit-errors';
import { buildDeps, buildDeposit } from '../../testing/payment-test-fixtures';

describe('RegisterAdjustmentHandler (PAG-P03 / UC-PAG-003)', () => {
  it('registra un ajuste valido y devuelve el registro creado', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const deposit = buildDeposit({ originalAmount: 500, adjustments: [] });
    deps.deposits.findById.mockResolvedValue(deposit);
    deps.deposits.addAdjustment.mockResolvedValue({
      id: 'adj-1',
      depositId: deposit.id,
      type: 'DISCOUNT',
      amount: 150,
      reason: 'Dano parachoques',
      authorizedBy: 'uid-1',
      createdAt: new Date(),
    });

    const handler = new RegisterAdjustmentHandler(deps.access, deps.deposits, deps.auditRepository);
    const result = await handler.execute(
      new RegisterAdjustmentCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1', 'DISCOUNT', 150, 'Dano parachoques'),
    );

    expect(result.amount).toBe(150);
    expect(deps.deposits.addAdjustment).toHaveBeenCalledWith(deposit.id, expect.objectContaining({ type: 'DISCOUNT', amount: 150 }));
  });

  it('lanza AdjustmentAmountExceedsDepositError cuando el monto supera el saldo (BR-PAG-001)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const deposit = buildDeposit({ originalAmount: 300, adjustments: [{ amount: 200 }] });
    deps.deposits.findById.mockResolvedValue(deposit);

    const handler = new RegisterAdjustmentHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new RegisterAdjustmentCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1', 'DISCOUNT', 200, 'Excede saldo')),
    ).rejects.toThrow(AdjustmentAmountExceedsDepositError);

    expect(deps.deposits.addAdjustment).not.toHaveBeenCalled();
  });

  it('lanza DepositInTerminalStateError para garantia en estado terminal (INV-PAG-001)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    const deposit = buildDeposit({ status: 'RETURNED' });
    deps.deposits.findById.mockResolvedValue(deposit);

    const handler = new RegisterAdjustmentHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new RegisterAdjustmentCommand(deposit.id, 'uid-1', 'comp-1', 'branch-1', 'DISCOUNT', 100, 'Terminal')),
    ).rejects.toThrow(DepositInTerminalStateError);
  });

  it('lanza DepositNotFoundError para garantia de otra empresa (INV-PAG-005 — multiempresa 404)', async () => {
    const deps = buildDeps({ role: 'FRONT_OFFICE' });
    deps.deposits.findById.mockResolvedValue(null);

    const handler = new RegisterAdjustmentHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new RegisterAdjustmentCommand('dep-other', 'uid-1', 'comp-1', 'branch-1', 'DISCOUNT', 100, 'Otra empresa')),
    ).rejects.toThrow(DepositNotFoundError);
  });

  it('lanza ForbiddenException cuando el rol no tiene permiso REGISTER_ADJUSTMENT (BR-PAG-007)', async () => {
    const deps = buildDeps({ role: 'AUDITORIA' });

    const handler = new RegisterAdjustmentHandler(deps.access, deps.deposits, deps.auditRepository);
    await expect(
      handler.execute(new RegisterAdjustmentCommand('dep-1', 'uid-1', 'comp-1', 'branch-1', 'DISCOUNT', 100, 'Sin permiso')),
    ).rejects.toThrow(ForbiddenException);
  });
});
