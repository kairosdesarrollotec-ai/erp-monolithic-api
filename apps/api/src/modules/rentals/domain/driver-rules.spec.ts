import { holderTypeFromContractVariant, isCompanyDriverVariantCode } from './contract-variant';
import { computeNoDepositBreakdown, resolveReservationCredit } from './reservation-credit';

describe('DEC-ALQ-COMPANY-DRIVER-004 / OWN-DRIVER-005 - reglas de dominio', () => {
  it('holderTypeFromContractVariant deriva el titular del codigo guardado', () => {
    expect(holderTypeFromContractVariant('NATURAL_NO_DRIVER')).toBe('NATURAL');
    expect(holderTypeFromContractVariant('LEGAL_WITH_DRIVER')).toBe('LEGAL');
    expect(holderTypeFromContractVariant(null)).toBeNull();
    expect(holderTypeFromContractVariant('OTRO')).toBeNull();
  });

  it('isCompanyDriverVariantCode', () => {
    expect(isCompanyDriverVariantCode('NATURAL_WITH_DRIVER')).toBe(true);
    expect(isCompanyDriverVariantCode('LEGAL_NO_DRIVER')).toBe(false);
    expect(isCompanyDriverVariantCode(undefined)).toBe(false);
  });

  it('sin garantia NO hay saldo a favor (decision 2, 22-oct-2026): el monto de la reserva queda como no aplicado para Finanzas; sin reserva, 0.00', () => {
    const credit = resolveReservationCredit({
      reservationId: 'r1',
      status: 'CONFIRMED',
      amount: '300',
      currency: 'PEN',
      paymentValidatedAt: new Date(),
    });
    expect(computeNoDepositBreakdown(credit)).toEqual({ reservationCreditExcess: '0.00', unappliedReservationAmount: '300.00', currency: 'PEN' });
    expect(computeNoDepositBreakdown(resolveReservationCredit(null))).toEqual({ reservationCreditExcess: '0.00', unappliedReservationAmount: '0.00', currency: null });
  });

  it('reserva cancelada o sin pago validado no deja monto sin aplicar', () => {
    const base = { reservationId: 'r1', amount: '300', currency: 'PEN' };
    expect(computeNoDepositBreakdown(resolveReservationCredit({ ...base, status: 'CANCELLED', paymentValidatedAt: new Date() })).unappliedReservationAmount).toBe('0.00');
    expect(computeNoDepositBreakdown(resolveReservationCredit({ ...base, status: 'CONFIRMED', paymentValidatedAt: null })).unappliedReservationAmount).toBe('0.00');
  });
});
