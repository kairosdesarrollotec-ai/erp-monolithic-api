import { Injectable } from '@nestjs/common';
import type { HrMemo } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { HrMemoRepositoryPort } from '../ports/hr-memo-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { GetEmployeeMemosQuery } from './get-employee-memos.query';

/** Memorandos de advertencia del expediente del colaborador (generados por el sistema por reincidencia). */
@Injectable()
export class GetEmployeeMemosHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly memos: HrMemoRepositoryPort,
  ) {}

  async execute(query: GetEmployeeMemosQuery): Promise<{ employeeName: string; items: HrMemo[] }> {
    const employee = await this.employees.findById(query.employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(query.employeeId);
    }
    await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: employee.operatingCompanyId, branchId: employee.branchId },
      'VIEW_EMPLOYEES',
    );
    return { employeeName: employee.fullName, items: await this.memos.findByEmployee(employee.id) };
  }
}
