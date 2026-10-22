import { buildVehicleDataWarnings } from './vehicle-data-warnings';

describe('buildVehicleDataWarnings (DEC-ALQ-VEHDATA-001)', () => {
  it('sin avisos cuando capacidad, garantia y combustible estan definidos', () => {
    expect(buildVehicleDataWarnings({ passengerCapacity: 5, depositMinimum: 500, fuelPrice: 4.5 })).toEqual([]);
  });

  it('garantia 0 y combustible 0 cuentan como definidos', () => {
    expect(buildVehicleDataWarnings({ passengerCapacity: 4, depositMinimum: 0, fuelPrice: 0 })).toEqual([]);
  });

  it('un aviso por cada dato faltante, con codigo y campo', () => {
    const out = buildVehicleDataWarnings({ passengerCapacity: null, depositMinimum: undefined, fuelPrice: null });
    expect(out.map((w) => w.code)).toEqual([
      'VEHICLE_PASSENGER_CAPACITY_MISSING',
      'VEHICLE_DEPOSIT_MINIMUM_MISSING',
      'VEHICLE_FUEL_PRICE_MISSING',
    ]);
    expect(out.map((w) => w.field)).toEqual(['passengerCapacity', 'depositMinimum', 'fuelPrice']);
  });

  it('capacidad 0 (dato heredado invalido) se avisa como faltante', () => {
    expect(buildVehicleDataWarnings({ passengerCapacity: 0, depositMinimum: 1, fuelPrice: 1 })).toHaveLength(1);
  });
});
