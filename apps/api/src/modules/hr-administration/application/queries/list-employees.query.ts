import type { EmployeeStatus } from '@prisma/client';

export class ListEmployeesQuery {
  constructor(
    public readonly firebaseUid: string,
    public readonly companyId: string,
    public readonly branchId: string,
    public readonly status?: EmployeeStatus,
    public readonly areaId?: string,
    public readonly search?: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
