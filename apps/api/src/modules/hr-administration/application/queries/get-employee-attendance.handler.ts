import { Injectable } from '@nestjs/common';
import type { AttendanceRecord } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { parsePayrollMonth } from '../../domain/hr-administration-rules';
import { GetEmployeeAttendanceQuery } from './get-employee-attendance.query';

export interface EmployeeAttendanceResult {
  employeeName: string;
  items: AttendanceRecord[];
}

@Injectable()
export class GetEmployeeAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
  ) {}

  async execute(query: GetEmployeeAttendanceQuery): Promise<EmployeeAttendanceResult> {
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

    if (query.month) {
      parsePayrollMonth(query.month);
    }

    const items = await this.attendance.findManyByEmployee(employee.id, {
      month: query.month,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return { employeeName: employee.fullName, items };
  }
}
