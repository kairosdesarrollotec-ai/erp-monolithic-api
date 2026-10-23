import { toReservationResponse } from './reservation.mapper';
import { ReservationRecord } from '../../application/ports/reservation-repository.port';
import { ReservationSaleResolutionRecord } from '../../domain/reservation-sale-resolution';

function record(overrides: Partial<ReservationRecord> = {}): ReservationRecord {
  return {
    id: 'res-1', organizationId: 'org-1', operatingCompanyId: 'company-1', branchId: 'branch-1',
    inquiryId: null, customerId: 'cust-1', customerName: 'Maria', vehicleId: 'veh-1', vehiclePlate: 'AAA-111',
    vehicleLabel: 'Toyota Hilux - AAA-111', status: 'CONFIRMED', channelMode: 'PRESENCIAL',
    startAt: new Date('2026-10-20T14:00:00Z'), endAt: new Date('2026-10-22T14:00:00Z'),
    requiredPaymentAmount: '300.00', currency: 'PEN', paymentPolicyVersion: 1,
    paymentValidatedAt: new Date(), documentsCompletedAt: new Date(), confirmedAt: new Date(),
    createdAt: new Date('2026-10-01T00:00:00Z'), createdBy: 'uid-1', version: 2,
    ...overrides,
  };
}

describe('toReservationResponse', () => {
  it('startDatePassed (RES-08): false antes de startAt, true desde startAt', () => {
    expect(toReservationResponse(record(), { now: new Date('2026-10-20T13:59:59Z') }).startDatePassed).toBe(false);
    expect(toReservationResponse(record(), { now: new Date('2026-10-20T14:00:00Z') }).startDatePassed).toBe(true);
    expect(toReservationResponse(record(), { now: new Date('2026-10-21T00:00:00Z') }).startDatePassed).toBe(true);
  });

  it('omite saleResolution si no se consulto; null si nunca hubo venta; lo serializa si existe', () => {
    expect('saleResolution' in toReservationResponse(record())).toBe(false);
    expect(toReservationResponse(record(), { saleResolution: null }).saleResolution).toBeNull();

    const resolution: ReservationSaleResolutionRecord = {
      id: 'rs-1', reservationId: 'res-1', reason: 'VEHICLE_SOLD', status: 'REJECTED', originalVehicleId: 'veh-1',
      offeredVehicle: { id: 'veh-2', plate: 'BBB-222', label: 'Kia Rio - BBB-222' }, offerNote: 'Fotos enviadas',
      flaggedBy: 'uid-1', flaggedAt: new Date('2026-10-13T10:00:00Z'), alternativeVehicleId: null,
      refundStatus: 'PENDING_TRANSFER', resolutionNote: null, resolvedBy: 'uid-2', resolvedAt: new Date('2026-10-13T12:00:00Z'),
    };
    expect(toReservationResponse(record({ status: 'CANCELLED' }), { saleResolution: resolution }).saleResolution).toEqual({
      id: 'rs-1', status: 'REJECTED', reason: 'VEHICLE_SOLD',
      offeredVehicle: { id: 'veh-2', plate: 'BBB-222', label: 'Kia Rio - BBB-222' }, offerNote: 'Fotos enviadas',
      flaggedAt: '2026-10-13T10:00:00.000Z', alternativeVehicleId: null, refundStatus: 'PENDING_TRANSFER',
      resolutionNote: null, resolvedAt: '2026-10-13T12:00:00.000Z',
    });
  });

  it('DEC-ALQ-VEHDATA-001: expone vehicleWarnings (vacio por defecto; los del record si hay datos faltantes del vehiculo)', () => {
    expect(toReservationResponse(record()).vehicleWarnings).toEqual([]);
    const warning = { code: 'VEHICLE_FUEL_PRICE_MISSING' as const, field: 'fuelPrice' as const, message: 'x' };
    expect(toReservationResponse(record({ vehicleWarnings: [warning] })).vehicleWarnings).toEqual([warning]);
  });

  it('DAT-RES-001 / BR-RES-005: expone canComeToOffice y customerLocation (null por defecto o valores asignados)', () => {
    const defaultResp = toReservationResponse(record());
    expect(defaultResp.canComeToOffice).toBeNull();
    expect(defaultResp.customerLocation).toBeNull();

    const customResp = toReservationResponse(record({ canComeToOffice: true, customerLocation: 'AYACUCHO' }));
    expect(customResp.canComeToOffice).toBe(true);
    expect(customResp.customerLocation).toBe('AYACUCHO');

    const virtualResp = toReservationResponse(record({ canComeToOffice: false, customerLocation: 'FUERA_DE_AYACUCHO' }));
    expect(virtualResp.canComeToOffice).toBe(false);
    expect(virtualResp.customerLocation).toBe('FUERA_DE_AYACUCHO');
  });
});
