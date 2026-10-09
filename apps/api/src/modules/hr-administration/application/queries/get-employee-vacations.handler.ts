import { Injectable } from '@nestjs/common';
import type { VacationRequest } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { GetEmployeeVacationsQuery } from './get-employee-vacations.query';

export interface EmployeeVacationsResult {
  employeeName: string;
  areaName: string;
  items: VacationRequest[];
}

@Injectable()
export class GetEmployeeVacationsHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly vacations: VacationRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
  ) {}

  async execute(query: GetEmployeeVacationsQuery): Promise<EmployeeVacationsResult> {
    const employee = await this.employees.findById(query.employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(query.employeeId);
    }

    await this.access.authorize(
      {
        firebaseUid: query.firebaseUid,
        companyId: employee.operatingCompanyId,
        branchId: employee.branchId,
      },
      'VIEW_EMPLOYEES',
    );

    const items = await this.vacations.findByEmployee(employee.id);
    return { employeeName: employee.fullName, areaName: employee.areaName, items };
  }
}
