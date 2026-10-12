import { AdjustmentAmountExceedsDepositError, DepositInTerminalStateError } from './deposit-errors';
import type { DepositStatus } from './deposit-status';
import { isTerminalStatus } from './deposit-status';

/**
 * INV-PAG-001: la garantia debe estar en estado no-terminal para admitir comandos.
 * Terminal: RETURNED, RETAINED, PARTIALLY_RETAINED (BDD-PAG-001, payments.yaml 409 DEPOSIT_IN_TERMINAL_STATE).
 */
export function assertDepositNotTerminal(status: DepositStatus): void {
  if (isTerminalStatus(status)) {
    throw new DepositInTerminalStateError(status);
  }
}

/**
 * INV-PAG-003 / BR-PAG-001: la suma de todos los ajustes existentes mas el nuevo monto no puede superar
 * el monto original de la garantia (BDD-PAG-001, payments.yaml 400).
 * Todos los montos se expresan como numeros positivos.
 */
export function assertAdjustmentAmountValid(
  originalAmount: number,
  existingAdjustments: readonly { amount: number }[],
  newAmount: number,
): void {
  const alreadyUsed = existingAdjustments.reduce((sum, a) => sum + a.amount, 0);
  const available = originalAmount - alreadyUsed;
  if (newAmount > available) {
    throw new AdjustmentAmountExceedsDepositError(
      Math.max(0, available),
      newAmount,
    );
  }
}
