/**
 * Estados del ciclo de vida de una garantia de alquiler (BDD-PAG-001 DAT-PAG-002).
 * Terminal: la garantia ya fue resuelta y no admite mas ajustes ni transiciones.
 */
export type DepositStatus = 'HELD' | 'RETURNED' | 'RETAINED' | 'PARTIALLY_RETAINED';

export const TERMINAL_DEPOSIT_STATUSES: readonly DepositStatus[] = ['RETURNED', 'RETAINED', 'PARTIALLY_RETAINED'];

export function isTerminalStatus(status: DepositStatus): boolean {
  return (TERMINAL_DEPOSIT_STATUSES as readonly string[]).includes(status);
}
