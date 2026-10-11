import { Injectable } from '@nestjs/common';
import type { AttendanceRecord } from '@prisma/client';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import { EmployeeRepositoryPort } from '../ports/employee-repository.port';
import {
  AttendanceAlreadyLoggedError,
  EmployeeNotFoundError,
  EmployeeTerminatedError,
} from '../../domain/hr-administration-errors';
import { resolveAttendanceRecord } from '../../domain/hr-administration-rules';
import { LogAttendanceCommand } from './log-attendance.command';

/**
 * ADP-P01..04 / BR-ADP-001: registra asistencia, tardanza o falta. El descuento queda PENDIENTE: la quincena se
 * paga íntegra y los descuentos solo se aplican a fin de mes (ApplyMonthDeductionsHandler).
 */
@Injectable()
export class LogAttendanceHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly employees: EmployeeRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: LogAttendanceCommand): Promise<AttendanceRecord> {
    const found = await this.employees.findById(command.employeeId);
    if (!found) {
      throw new EmployeeNotFoundError(command.employeeId);
    }

    const { context } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: found.operatingCompanyId,
        branchId: found.branchId,
      },
      'LOG_ATTENDANCE',
    );

    return this.transactionManager.run(async (tx) => {
      const employee = await this.employees.findById(command.employeeId, tx);
      if (!employee) {
        throw new EmployeeNotFoundError(command.employeeId);
      }
      if (employee.status === 'TERMINADO') {
        throw new EmployeeTerminatedError(employee.id);
      }

      const existing = await this.attendance.findByEmployeeAndDate(command.employeeId, command.date, tx);
      if (existing) {
        throw new AttendanceAlreadyLoggedError(command.employeeId, command.date.toISOString().slice(0, 10));
      }

      const resolved = resolveAttendanceRecord({
        status: command.status,
        minutesLate: command.minutesLate,
        deductionAmount: command.deductionAmount,
        baseSalary: employee.baseSalary ? Number(employee.baseSalary) : null,
      });

      const created = await this.attendance.create(
        {
          employeeId: command.employeeId,
          date: command.date,
          checkInTime: command.checkInTime ?? null,
          checkOutTime: command.checkOutTime ?? null,
          status: command.status,
          minutesLate: resolved.minutesLate,
          deductionAmount: resolved.deductionAmount,
          notes: command.notes?.trim() || null,
          createdById: command.firebaseUid,
        },
        tx,
      );

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'attendance',
          entityId: created.id,
          action: 'ATTENDANCE_LOGGED',
          changes: {
            employeeId: created.employeeId,
            date: created.date,
            status: created.status,
            minutesLate: created.minutesLate,
            deductionAmount: Number(created.deductionAmount),
          },
        },
        tx,
      );

      return created;
    });
  }
}
