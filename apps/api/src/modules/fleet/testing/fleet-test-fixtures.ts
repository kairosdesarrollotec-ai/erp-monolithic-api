import { ForbiddenException } from '@nestjs/common';
import { FleetVehicle, VehicleStatus } from '../domain/vehicle';
import { FleetVehicleRepositoryPort } from '../application/ports/fleet-vehicle-repository.port';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import { MatrixAuthorizationService } from '../../authorization/matrix-authorization.service';
import { FleetAccessService } from '../application/services/fleet-access.service';
import type { WorkerRole } from '../../users/domain/worker-role';
import { testRole, roleKeyOfTestRoleId } from '../../users/testing/role-fixtures';
import { assertFleetWrite, assertFleetRead, assertFleetCrossBranchPermission } from '../application/policies/fleet-role.policy';

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
    findConflicts: jest.fn().mockResolvedValue(new Map()),
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

/** La matriz simulada aplica la misma politica rol-accion que la version 0 real (fleet-role.policy.ts). */
export function buildFleetAccessService(
  role: WorkerRole | 'forbidden' = 'CAMPO',
): { access: FleetAccessService; workContext: jest.Mocked<WorkContextAuthorizationService> } {
  const workContext = {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: ORG, companyId: COMPANY, branchId: BRANCH, ...testRole(role) }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;

  const matrixAuth = {
    assertAllowed: jest.fn(async (_org: string, roleId: string, module: string, action: string) => {
      const r = roleKeyOfTestRoleId(roleId);
      try {
        if (module === 'FLEET') {
          if (action === 'WRITE') assertFleetWrite(r);
          else if (action === 'READ') assertFleetRead(r);
          else assertFleetCrossBranchPermission(r);
        }
      } catch {
        throw new ForbiddenException({ code: 'ROLE_NOT_ALLOWED', detail: `El rol ${r} no tiene permiso para ${module}.${action}` });
      }
    }),
  } as unknown as jest.Mocked<MatrixAuthorizationService>;

  return {
    workContext,
    access: new FleetAccessService(workContext, matrixAuth),
  };
}
