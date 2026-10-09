import { Injectable } from '@nestjs/common';
import { HrAdministrationAccessService } from '../services/hr-administration-access.service';
import { AttendanceRepositoryPort, MonthlyAttendanceItem } from '../ports/attendance-repository.port';
import { parsePayrollMonth } from '../../domain/hr-administration-rules';
import { GetAttendanceSummaryQuery } from './get-attendance-summary.query';

export interface MonthlyAttendanceSummaryResult {
  companyId: string;
  month: string;
  totalEmployees: number;
  totalDeductionsAmount: number;
  items: MonthlyAttendanceItem[];
}

/** BR-ADP-001: resumen mensual de tardanzas/faltas injustificadas y descuentos calculados (pendientes o ya aplicados). */
@Injectable()
export class GetAttendanceSummaryHandler {
  constructor(
    private readonly access: HrAdministrationAccessService,
    private readonly attendance: AttendanceRepositoryPort,
  ) {}

  async execute(query: GetAttendanceSummaryQuery): Promise<MonthlyAttendanceSummaryResult> {
    const { scope } = await this.access.authorizeAny(
      {
        firebaseUid: query.firebaseUid,
        companyId: query.companyId,
        branchId: query.branchId,
      },
      ['VIEW_EMPLOYEES', 'LOG_ATTENDANCE'],
    );

    parsePayrollMonth(query.month);

    const items = await this.attendance.summarizeMonth(scope.operatingCompanyId, query.month);
    const totalDeductionsAmount =
      Math.round(items.reduce((sum, item) => sum + item.calculatedDeduction, 0) * 100) / 100;

    return {
      companyId: scope.operatingCompanyId,
      month: query.month,
      totalEmployees: items.length,
      totalDeductionsAmount,
      items,
    };
  }
}
