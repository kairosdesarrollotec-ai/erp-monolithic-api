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
      createdAt: '2026-09-28T10:00:00.000Z',
      updatedAt: '2026-09-28T10:00:00.000Z',
    });
  });
});
