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

  it('sin garantia, todo el credito de reserva validado pasa a saldo a favor; sin reserva, 0.00', () => {
    const credit = resolveReservationCredit({
      reservationId: 'r1',
      status: 'CONFIRMED',
      amount: '300',
      currency: 'PEN',
      paymentValidatedAt: new Date(),
    });
    expect(computeNoDepositBreakdown(credit)).toEqual({ reservationCreditExcess: '300.00', currency: 'PEN' });
    expect(computeNoDepositBreakdown(resolveReservationCredit(null))).toEqual({ reservationCreditExcess: '0.00', currency: null });
  });

  it('reserva cancelada o sin pago validado no genera saldo a favor', () => {
    const base = { reservationId: 'r1', amount: '300', currency: 'PEN' };
    expect(computeNoDepositBreakdown(resolveReservationCredit({ ...base, status: 'CANCELLED', paymentValidatedAt: new Date() })).reservationCreditExcess).toBe('0.00');
    expect(computeNoDepositBreakdown(resolveReservationCredit({ ...base, status: 'CONFIRMED', paymentValidatedAt: null })).reservationCreditExcess).toBe('0.00');
  });
});
