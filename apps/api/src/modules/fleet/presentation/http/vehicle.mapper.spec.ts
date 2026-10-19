import { toVehicleResponse } from './vehicle.mapper';
import { FleetVehicle } from '../../domain/vehicle';

describe('toVehicleResponse', () => {
  it('convierte FleetVehicle a VehicleResponse serializable', () => {
    const vehicle: FleetVehicle = {
      id: 'v-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      branchId: 'b-1',
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2024,
      color: 'Gris',
      category: 'PICKUP',
      status: 'AVAILABLE',
      dailyRate: 250,
      photoUrl: 'https://storage.googleapis.com/test-bucket/vehicle-photos/hilux.jpg',
      createdAt: new Date('2026-09-28T10:00:00.000Z'),
      updatedAt: new Date('2026-09-28T10:00:00.000Z'),
    };

    const res = toVehicleResponse(vehicle);

    expect(res).toEqual({
      id: 'v-1',
      organizationId: 'org-1',
      operatingCompanyId: 'comp-1',
      branchId: 'b-1',
      plate: 'ABC-123',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2024,
      color: 'Gris',
      category: 'PICKUP',
      status: 'AVAILABLE',
      dailyRate: 250,
      photoUrl: 'https://storage.googleapis.com/test-bucket/vehicle-photos/hilux.jpg',
      depositMinimum: null,
      passengerCapacity: null,
      fuelPrice: null,
      createdAt: '2026-09-28T10:00:00.000Z',
      updatedAt: '2026-09-28T10:00:00.000Z',
    });
  });
});

describe('toVehicleResponse - availability', () => {
  const base: FleetVehicle = {
    id: 'v-1',
    organizationId: 'org-1',
    operatingCompanyId: 'comp-1',
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Hilux',
    status: 'AVAILABLE',
    createdAt: new Date('2026-09-28T10:00:00.000Z'),
    updatedAt: new Date('2026-09-28T10:00:00.000Z'),
  };

  it('no incluye availability si el vehículo no la trae', () => {
    expect(toVehicleResponse(base)).not.toHaveProperty('availability');
  });

  it('available true no lleva campos de conflicto', () => {
    expect(toVehicleResponse({ ...base, availability: { available: true } }).availability).toEqual({ available: true });
  });

  it('serializa el conflicto a ISO 8601', () => {
    const res = toVehicleResponse({
      ...base,
      availability: {
        available: false,
        conflictFrom: new Date('2026-10-22T00:00:00.000Z'),
        conflictTo: new Date('2026-10-28T00:00:00.000Z'),
        conflictSource: 'RESERVATION',
      },
    });
    expect(res.availability).toEqual({
      available: false,
      conflictFrom: '2026-10-22T00:00:00.000Z',
      conflictTo: '2026-10-28T00:00:00.000Z',
      conflictSource: 'RESERVATION',
    });
  });
});
