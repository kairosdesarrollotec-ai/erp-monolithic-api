import { ForbiddenException } from '@nestjs/common';
import { Customer } from '../domain/customer';
import { CustomerRepositoryPort } from '../application/ports/customer-repository.port';
import { WorkContextAuthorizationService } from '../../users/application/services/work-context-authorization.service';
import type { WorkerRole } from '../../users/domain/worker-role';

export const ORG = 'org-1';
export const COMPANY = 'company-1';
export const BRANCH = 'branch-1';

export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    organizationId: ORG,
    operatingCompanyId: COMPANY,
    fullName: 'Juan Perez',
    documentType: 'DNI',
    documentNumber: '12345678',
    nationality: 'PERUANO',
    countryEntryDate: null,
    email: 'juan.perez@example.com',
    phone: '+51999888777',
    address: 'Av. Sol 123, Cusco',
    createdAt: new Date('2026-09-28T10:00:00Z'),
    updatedAt: new Date('2026-09-28T10:00:00Z'),
    ...overrides,
  };
}

export function buildCustomerRepository(existing: Customer | null = buildCustomer()): jest.Mocked<CustomerRepositoryPort> {
  return {
    create: jest.fn().mockImplementation(async (input) =>
      buildCustomer({
        id: 'cust-new',
        organizationId: input.organizationId,
        operatingCompanyId: input.operatingCompanyId,
        fullName: input.fullName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        nationality: input.nationality ?? null,
        countryEntryDate: input.countryEntryDate ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
      }),
    ),
    findById: jest.fn().mockImplementation(async (id: string) => (existing && existing.id === id ? existing : null)),
    findByDocument: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockImplementation(async (id: string, _scope, data) =>
      buildCustomer({
        id,
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        nationality: data.nationality ?? null,
        countryEntryDate: data.countryEntryDate ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
      }),
    ),
    list: jest.fn().mockResolvedValue({
      items: existing ? [existing] : [],
      total: existing ? 1 : 0,
    }),
  };
}

export function buildWorkContext(role: WorkerRole | 'forbidden' = 'FRONT_OFFICE'): jest.Mocked<WorkContextAuthorizationService> {
  return {
    authorize:
      role === 'forbidden'
        ? jest.fn().mockRejectedValue(new ForbiddenException())
        : jest.fn().mockResolvedValue({ organizationId: ORG, companyId: COMPANY, branchId: BRANCH, role }),
  } as unknown as jest.Mocked<WorkContextAuthorizationService>;
}
