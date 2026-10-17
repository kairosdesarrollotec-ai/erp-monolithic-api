import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CancelReservationDto } from '../presentation/http/dto/cancel-reservation.dto';
import {
  assertReservationCancelReason,
  isReservationCancelReason,
  RESERVATION_CANCEL_REASONS,
} from './reservation-cancel-reason';

describe('reservation-cancel-reason (DEC-RES-CANCEL-001)', () => {
  it('el enum cerrado contiene solo cambio solicitado y no-show', () => {
    expect([...RESERVATION_CANCEL_REASONS]).toEqual(['CUSTOMER_REQUESTED_CHANGE', 'NO_SHOW']);
  });

  it('la venta del vehiculo NO es una razon de cancel (va por resolve-sale)', () => {
    expect(isReservationCancelReason('VEHICLE_SOLD_REFUND')).toBe(false);
    expect(() => assertReservationCancelReason('VEHICLE_SOLD_REFUND')).toThrow();
  });

  it('el DTO rechaza motivos libres y acepta los dos del enum', async () => {
    const base = { companyId: '11111111-1111-4111-8111-111111111111', branchId: '22222222-2222-4222-8222-222222222222' };
    const bad = await validate(plainToInstance(CancelReservationDto, { ...base, reason: 'porque si' }));
    expect(bad.some((e) => e.property === 'reason')).toBe(true);
    for (const reason of RESERVATION_CANCEL_REASONS) {
      expect(await validate(plainToInstance(CancelReservationDto, { ...base, reason }))).toHaveLength(0);
    }
  });
});
