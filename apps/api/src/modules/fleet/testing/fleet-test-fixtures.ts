import { ForbiddenException } from '@nestjs/common';
import { FleetVehicle, VehicleStatus } from '../domain/vehicle';
import { FleetVehicleRepositoryPort } from '../application/ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';

export const ORG = 'org-1';
export const COMPANY = 'company-1';
export const BRANCH = 'branch-1';

export function buildFleetVehicle(overrides: Partial<FleetVehicle> = {}): FleetVehicle {
  return {
    id: 'veh-1',
    organizationId: ORG,
    operatingCompanyId: COMPANY,
    branchId: BRANCH,
    plate: 'ABC-123',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2024,
    color: 'Blanco',
    category: 'PICKUP',
    status: 'AVAILABLE',
    dailyRate: 250,
    photoUrl: 'https://storage.googleapis.com/test-bucket/vehicle-photos/hilux.jpg',
    createdAt: new Date('2026-09-28T10:00:00Z'),
    updatedAt: new Date('2026-09-28T10:00:00Z'),
    ...overrides,
  };
}

export function buildFleetVehicleRepository(
  existing: FleetVehicle | null = buildFleetVehicle(),
): jest.Mocked<FleetVehicleRepositoryPort> {
  return {
    create: jest.fn().mockImplementation(async (input) =>
      buildFleetVehicle({
        id: 'veh-new',
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        branchId: input.branchId ?? null,
        plate: input.plate,
        brand: input.brand,
        model: input.model,
        year: input.year ?? null,
        color: input.color ?? null,
        category: input.category ?? 'SEDAN',
        status: input.status ?? 'AVAILABLE',
        dailyRate: input.dailyRate ?? null,
        photoUrl: input.photoUrl ?? null,
      }),
    ),
    findById: jest.fn().mockImplementation(async (id: string) => (existing && existing.id === id ? existing : null)),
    findByPlate: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({
      items: existing ? [existing] : [],
      total: existing ? 1 : 0,
    }),
    updateStatus: jest.fn().mockImplementation(async (_id: string, _scope: unknown, status: VehicleStatus) =>
      buildFleetVehicle({ ...existing, status }),
    ),
    update: jest.fn().mockImplementation(async (_id: string, _scope: unknown, input) =>
      buildFleetVehicle({ ...existing, ...input }),
    ),
  };
}

export function buildWorkContext(
  role: WorkerRole | 'forbidden' = 'FRONT_OFFICE',
): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: ORG, companyId: COMPANY, branchId: BRANCH, role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}
