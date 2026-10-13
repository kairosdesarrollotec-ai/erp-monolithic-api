import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { TrainingRepositoryPort, TrainingWithAttendees } from '../ports/training-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { GetEmployeeTrainingsQuery } from './get-employee-trainings.query';

/** Historial de capacitación del colaborador (DAT-ADP-009 / BR-ADP-008). */
@Injectable()
export class GetEmployeeTrainingsHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly trainings: TrainingRepositoryPort,
  ) {}

  async execute(query: GetEmployeeTrainingsQuery): Promise<{ employeeName: string; items: TrainingWithAttendees[] }> {
    const employee = await this.employees.findById(query.employeeId);
    if (!employee) {
      throw new EmployeeNotFoundError(query.employeeId);
    }
    await this.access.authorize(
      { firebaseUid: query.firebaseUid, companyId: employee.operatingCompanyId, branchId: employee.branchId },
      'VIEW_EMPLOYEES',
    );
    return { employeeName: employee.fullName, items: await this.trainings.findByEmployee(employee.id) };
  }
}
