import {
  ReservationCreditCurrencyMismatchError,
  ReservationCreditSource,
  computeDepositBreakdown,
  resolveReservationCredit,
} from './reservation-credit';

describe('P0-03 opcion (a) - traslado del monto de la reserva a la garantia', () => {
  const source = (overrides: Partial<ReservationCreditSource> = {}): ReservationCreditSource => ({
    reservationId: 'res-1',
    status: 'CONFIRMED',
    amount: '300.00',
    currency: 'PEN',
    paymentValidatedAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  });

  describe('resolveReservationCredit', () => {
    it('alquiler directo (sin reserva): no hay traslado', () => {
      expect(resolveReservationCredit(null)).toEqual({
        applicable: false,
        reason: 'NO_RESERVATION',
        reservationId: null,
        amount: '0.00',
        currency: null,
      });
    });

    it('origen Reserva CONFIRMED con pago validado: traslada el monto integro', () => {
      expect(resolveReservationCredit(source())).toEqual({
        applicable: true,
        reason: 'APPLIED',
        reservationId: 'res-1',
        amount: '300.00',
        currency: 'PEN',
      });
    });

    it('reserva CONVERTED tambien traslada', () => {
      expect(resolveReservationCredit(source({ status: 'CONVERTED' })).applicable).toBe(true);
    });

    it('reserva con monto distinto del estandar (S/450): traslada ese monto, no S/300', () => {
      const result = resolveReservationCredit(source({ amount: '450' }));
      expect(result.applicable).toBe(true);
      expect(result.amount).toBe('450.00');
    });

    it.each(['CANCELLED', 'DRAFT', 'PENDING_SALE_RESOLUTION'])(
      'reserva %s (cancelada/no-show u otro estado no activo): no traslada nada',
      (status) => {
        const result = resolveReservationCredit(source({ status }));
        expect(result).toMatchObject({ applicable: false, reason: 'RESERVATION_NOT_ACTIVE', amount: '0.00' });
      },
    );

    it('pago de la reserva nunca validado: no traslada', () => {
      const result = resolveReservationCredit(source({ paymentValidatedAt: null }));
      expect(result).toMatchObject({ applicable: false, reason: 'PAYMENT_NOT_VALIDATED', amount: '0.00' });
    });
  });

  describe('computeDepositBreakdown', () => {
    it('origen Reserva: garantia S/1000 con S/300 de reserva cobra solo S/700', () => {
      const credit = resolveReservationCredit(source());
      expect(computeDepositBreakdown('1000.00', 'PEN', credit)).toEqual({
        totalAmount: '1000.00',
        reservationCreditAmount: '300.00',
        reservationCreditExcess: '0.00',
        amountToCollect: '700.00',
        currency: 'PEN',
      });
    });

    it('alquiler directo: se cobra la garantia completa', () => {
      const credit = resolveReservationCredit(null);
      expect(computeDepositBreakdown('500', 'PEN', credit)).toEqual({
        totalAmount: '500.00',
        reservationCreditAmount: '0.00',
        reservationCreditExcess: '0.00',
        amountToCollect: '500.00',
        currency: 'PEN',
      });
    });

    it('reserva cancelada: la garantia se cobra completa', () => {
      const credit = resolveReservationCredit(source({ status: 'CANCELLED' }));
      expect(computeDepositBreakdown('800.00', 'PEN', credit).amountToCollect).toBe('800.00');
    });

    it('reserva de monto distinto (S/450) sobre garantia S/800: cobra S/350', () => {
      const credit = resolveReservationCredit(source({ amount: '450.00' }));
      const breakdown = computeDepositBreakdown('800.00', 'PEN', credit);
      expect(breakdown.reservationCreditAmount).toBe('450.00');
      expect(breakdown.amountToCollect).toBe('350.00');
    });

    it('reserva igual a la garantia: diferencia 0.00', () => {
      const credit = resolveReservationCredit(source());
      expect(computeDepositBreakdown('300.00', 'PEN', credit).amountToCollect).toBe('0.00');
    });

    it('evita errores de coma flotante (0.1 + 0.2)', () => {
      const credit = resolveReservationCredit(source({ amount: '0.10' }));
      expect(computeDepositBreakdown('0.30', 'PEN', credit).amountToCollect).toBe('0.20');
    });

    it('monto de reserva mayor que la garantia: NO es error; cubre la garantia y el sobrante queda como excedente', () => {
      const credit = resolveReservationCredit(source({ amount: '600.00' }));
      expect(computeDepositBreakdown('500.00', 'PEN', credit)).toEqual({
        totalAmount: '500.00',
        reservationCreditAmount: '500.00',
        reservationCreditExcess: '100.00',
        amountToCollect: '0.00',
        currency: 'PEN',
      });
    });

    it('monto de reserva mayor que S/ 300 y menor que la garantia: sin excedente', () => {
      const credit = resolveReservationCredit(source({ amount: '450.00' }));
      const b = computeDepositBreakdown('800.00', 'PEN', credit);
      expect(b.reservationCreditExcess).toBe('0.00');
      expect(b.amountToCollect).toBe('350.00');
    });

    it('sin reserva aplicable: excedente 0.00', () => {
      expect(computeDepositBreakdown('500.00', 'PEN', resolveReservationCredit(null)).reservationCreditExcess).toBe('0.00');
    });

    it('moneda de la reserva distinta de la de la garantia: error explicito', () => {
      const credit = resolveReservationCredit(source({ currency: 'USD' }));
      expect(() => computeDepositBreakdown('500.00', 'PEN', credit)).toThrow(ReservationCreditCurrencyMismatchError);
    });
  });
});
