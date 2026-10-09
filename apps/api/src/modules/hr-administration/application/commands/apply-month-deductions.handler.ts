import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../../../common/application/ports/clock.port';
import { TransactionManagerPort } from '../../../../common/application/ports/transaction-manager.port';
import { AuditEventRepositoryPort } from '../../../audit/application/ports/audit-event-repository.port';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort } from '../ports/attendance-repository.port';
import { assertPayrollMonthClosable } from '../../domain/hr-administration-rules';
import { ApplyMonthDeductionsCommand } from './apply-month-deductions.command';

export interface ApplyMonthDeductionsResult {
  month: string;
  affectedEmployeesCount: number;
  totalDeductionsApplied: number;
  totalRecordsUpdated: number;
}

/**
 * ADP-P08 / BR-ADP-001 / SC-ADP-004.02: aplica los descuentos por faltas injustificadas y tardanzas al CIERRE de mes
 * (nunca en la quincena). Es idempotente: solo liquida registros que aún no fueron aplicados.
 */
@Injectable()
export class ApplyMonthDeductionsHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly transactionManager: TransactionManagerPort,
    private readonly clock: ClockPort,
    private readonly auditRepository: AuditEventRepositoryPort,
  ) {}

  async execute(command: ApplyMonthDeductionsCommand): Promise<ApplyMonthDeductionsResult> {
    const { context, scope } = await this.access.authorize(
      {
        firebaseUid: command.firebaseUid,
        companyId: command.companyId,
        branchId: command.branchId,
      },
      'MANAGE_EMPLOYEES',
    );

    const now = this.clock.now();
    assertPayrollMonthClosable(command.payrollMonth, now);

    return this.transactionManager.run(async (tx) => {
      const pending = await this.attendance.findPendingDeductions(
        scope.operatingCompanyId,
        command.payrollMonth,
        command.employeeIds,
        tx,
      );
      const attendanceIds = pending.flatMap((p) => p.attendanceIds);

      if (attendanceIds.length === 0) {
        return {
          month: command.payrollMonth,
          affectedEmployeesCount: 0,
          totalDeductionsApplied: 0,
          totalRecordsUpdated: 0,
        };
      }

      const totalAmount = Math.round(pending.reduce((sum, item) => sum + item.calculatedDeduction, 0) * 100) / 100;
      const updatedCount = await this.attendance.applyDeductions(attendanceIds, command.payrollMonth, now, tx);

      await this.auditRepository.recordHrAdministrationEvent(
        {
          organizationId: context.organizationId,
          actorUserId: command.firebaseUid,
          entityType: 'attendance',
          entityId: `deductions-${scope.operatingCompanyId}-${command.payrollMonth}`,
          action: 'DEDUCTIONS_APPLIED',
          changes: {
            payrollMonth: command.payrollMonth,
            totalRecordsUpdated: updatedCount,
            affectedEmployeesCount: pending.length,
            totalDeductionsApplied: totalAmount,
            employeeIds: pending.map((p) => p.employeeId),
          },
        },
        tx,
      );

      return {
        month: command.payrollMonth,
        affectedEmployeesCount: pending.length,
        totalDeductionsApplied: totalAmount,
        totalRecordsUpdated: updatedCount,
      };
    });
  }
}
