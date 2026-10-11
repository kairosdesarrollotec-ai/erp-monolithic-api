import { Injectable } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { ListEmployeesQuery } from './list-employees.query';

/** `branchId` es la sede del contexto de trabajo y también filtra el listado a esa sede. */
@Injectable()
export class ListEmployeesHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
  ) {}

  async execute(query: ListEmployeesQuery): Promise<{ items: Employee[]; total: number }> {
    const { scope } = await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      'VIEW_EMPLOYEES',
    );

    return this.employees.findMany({
      organizationId: scope.organizationId,
      companyId: scope.operatingCompanyId,
      branchId: scope.branchId,
      status: query.status,
      areaId: query.areaId,
      search: query.search?.trim() || undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
