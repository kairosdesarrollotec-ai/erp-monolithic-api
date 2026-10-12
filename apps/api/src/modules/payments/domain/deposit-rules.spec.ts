import { assertDepositNotTerminal, assertAdjustmentAmountValid } from './deposit-rules';
import { AdjustmentAmountExceedsDepositError, DepositInTerminalStateError } from './deposit-errors';
import type { DepositStatus } from './deposit-status';

describe('assertDepositNotTerminal (INV-PAG-001)', () => {
  it.each(['RETURNED', 'RETAINED', 'PARTIALLY_RETAINED'] as DepositStatus[])(
    'lanza DepositInTerminalStateError para estado terminal %s',
    (status) => {
      expect(() => assertDepositNotTerminal(status)).toThrow(DepositInTerminalStateError);
    },
  );

  it('no lanza para estado HELD (no-terminal)', () => {
    expect(() => assertDepositNotTerminal('HELD')).not.toThrow();
  });
});

describe('assertAdjustmentAmountValid (INV-PAG-003 / BR-PAG-001)', () => {
  it('permite un ajuste cuyo monto esta dentro del saldo disponible', () => {
    expect(() => assertAdjustmentAmountValid(500, [{ amount: 100 }], 200)).not.toThrow();
  });

  it('permite un ajuste que agota exactamente el saldo disponible', () => {
    expect(() => assertAdjustmentAmountValid(500, [{ amount: 100 }], 400)).not.toThrow();
  });

  it('lanza AdjustmentAmountExceedsDepositError cuando el ajuste supera el saldo disponible', () => {
    expect(() => assertAdjustmentAmountValid(500, [{ amount: 100 }], 401)).toThrow(AdjustmentAmountExceedsDepositError);
  });

  it('lanza cuando no hay ajustes previos pero el nuevo supera el original', () => {
    expect(() => assertAdjustmentAmountValid(300, [], 301)).toThrow(AdjustmentAmountExceedsDepositError);
  });

  it('lanza cuando los ajustes previos ya agotan la garantia y se solicita otro', () => {
    expect(() => assertAdjustmentAmountValid(300, [{ amount: 300 }], 1)).toThrow(AdjustmentAmountExceedsDepositError);
  });

  it('sin ajustes previos el saldo disponible es el monto original completo', () => {
    expect(() => assertAdjustmentAmountValid(500, [], 500)).not.toThrow();
  });
});
