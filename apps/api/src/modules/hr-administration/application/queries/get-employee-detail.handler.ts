import { Injectable } from '@nestjs/common';
import type { Employee, EmploymentTermination, HrMemo, LeaveRequest, VacationRequest } from '@prisma/client';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import { AttendanceRepositoryPort, EmployeeAttendanceTotals } from '../ports/attendance-repository.port';
import { LeaveRepositoryPort } from '../ports/leave-repository.port';
import { VacationRepositoryPort } from '../ports/vacation-repository.port';
import { FieldTripRepositoryPort, FieldTripWithEmployee } from '../ports/field-trip-repository.port';
import { EmploymentTerminationRepositoryPort } from '../ports/employment-termination-repository.port';
import { HrMemoRepositoryPort } from '../ports/hr-memo-repository.port';
import { TrainingRepositoryPort, TrainingWithAttendees } from '../ports/training-repository.port';
import { EmployeeNotFoundError } from '../../domain/hr-administration-errors';
import { GetEmployeeDetailQuery } from './get-employee-detail.query';

export const EMPLOYEE_DETAIL_RECENT_LIMIT = 10;

export interface EmployeeDetailResult {
  employee: Employee;
  attendanceSummary: EmployeeAttendanceTotals;
  recentLeaves: LeaveRequest[];
  recentVacations: VacationRequest[];
  recentFieldTrips: FieldTripWithEmployee[];
  termination: EmploymentTermination | null;
  /** Memorandos de advertencia generados por el sistema por reincidencia (ADP-P03 / BR-ADP-005). */
  recentMemos: HrMemo[];
  /** Historial de capacitación interna (DAT-ADP-009). */
  recentTrainings: TrainingWithAttendees[];
}

/** Expediente del colaborador (identidad propia: nunca fusionada con Cliente ni Candidato). */
@Injectable()
export class GetEmployeeDetailHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly employees: EmployeeRepositoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly leaves: LeaveRepositoryPort,
    private readonly vacations: VacationRepositoryPort,
    private readonly fieldTrips: FieldTripRepositoryPort,
    private readonly terminations: EmploymentTerminationRepositoryPort,
    private readonly memos: HrMemoRepositoryPort,
    private readonly trainings: TrainingRepositoryPort,
  ) {}

  async execute(query: GetEmployeeDetailQuery): Promise<EmployeeDetailResult> {
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

    const [attendanceSummary, recentLeaves, recentVacations, recentFieldTrips, termination, recentMemos, recentTrainings] =
      await Promise.all([
      this.attendance.totalsByEmployee(employee.id),
      this.leaves.findByEmployee(employee.id, EMPLOYEE_DETAIL_RECENT_LIMIT),
      this.vacations.findByEmployee(employee.id, EMPLOYEE_DETAIL_RECENT_LIMIT),
      this.fieldTrips.findMany({
        companyId: employee.operatingCompanyId,
        employeeId: employee.id,
        limit: EMPLOYEE_DETAIL_RECENT_LIMIT,
      }),
      this.terminations.findByEmployeeId(employee.id),
      this.memos.findByEmployee(employee.id, EMPLOYEE_DETAIL_RECENT_LIMIT),
      this.trainings.findByEmployee(employee.id, EMPLOYEE_DETAIL_RECENT_LIMIT),
    ]);

    return {
      employee,
      attendanceSummary,
      recentLeaves,
      recentVacations,
      recentFieldTrips,
      termination,
      recentMemos,
      recentTrainings,
    };
  }
}
