import { Injectable } from '@nestjs/common';
import type { LeaveRequest } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { GetEmployeeLeavesQuery } from './get-employee-leaves.query';

export interface EmployeeLeavesResult {
  employeeName: string;
  items: LeaveRequest[];
}

@Injectable()
export class GetEmployeeLeavesHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly leaves: LeaveRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
  ) {}

  async execute(query: GetEmployeeLeavesQuery): Promise<EmployeeLeavesResult> {
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

    const items = await this.leaves.findByEmployee(employee.id);
    return { employeeName: employee.fullName, items };
  }
}
