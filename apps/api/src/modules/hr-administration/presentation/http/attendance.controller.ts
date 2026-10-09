import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { LogAttendanceCommand } from '../../application/commands/log-attendance.command';
import { LogAttendanceHandler } from '../../application/commands/log-attendance.handler';
import { ApplyMonthDeductionsCommand } from '../../application/commands/apply-month-deductions.command';
import { ApplyMonthDeductionsHandler } from '../../application/commands/apply-month-deductions.handler';
import { GetEmployeeAttendanceQuery } from '../../application/queries/get-employee-attendance.query';
import { GetEmployeeAttendanceHandler } from '../../application/queries/get-employee-attendance.handler';
import { GetAttendanceSummaryQuery } from '../../application/queries/get-attendance-summary.query';
import { GetAttendanceSummaryHandler } from '../../application/queries/get-attendance-summary.handler';
import { LogAttendanceDto } from './dto/log-attendance.dto';
import { GetEmployeeAttendanceQueryDto } from './dto/get-employee-attendance-query.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { ApplyDeductionsDto } from './dto/apply-deductions.dto';
import { parseDateOnly } from './dto/hr-date';
import type {
  ApplyDeductionsResponse,
  AttendanceRecordResponse,
  MonthlyAttendanceSummaryResponse,
} from './dto/hr-administration.response';
import {
  toApplyDeductionsResponse,
  toAttendanceRecordResponse,
  toMonthlyAttendanceSummaryResponse,
} from './hr-administration.mapper';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class AttendanceController {
  constructor(
    private readonly logAttendance: LogAttendanceHandler,
    private readonly applyDeductions: ApplyMonthDeductionsHandler,
    private readonly getEmployeeAttendance: GetEmployeeAttendanceHandler,
    private readonly getAttendanceSummary: GetAttendanceSummaryHandler,
  ) {}

  @Post('employees/:id/attendance')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async log(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogAttendanceDto,
  ): Promise<AttendanceRecordResponse> {
    const created = await this.logAttendance.execute(
      new LogAttendanceCommand(
        req.firebaseUid!,
        id,
        parseDateOnly(dto.date),
        dto.status,
        dto.minutesLate,
        dto.deductionAmount,
        dto.checkInTime ? new Date(dto.checkInTime) : null,
        dto.checkOutTime ? new Date(dto.checkOutTime) : null,
        dto.notes,
      ),
    );
    return toAttendanceRecordResponse(created);
  }

  @Get('employees/:id/attendance')
  async listByEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetEmployeeAttendanceQueryDto,
  ): Promise<AttendanceRecordResponse[]> {
    const result = await this.getEmployeeAttendance.execute(
      new GetEmployeeAttendanceQuery(
        req.firebaseUid!,
        id,
        query.month,
        query.startDate ? parseDateOnly(query.startDate) : undefined,
        query.endDate ? parseDateOnly(query.endDate) : undefined,
      ),
    );
    return result.items.map((r) => toAttendanceRecordResponse(r, result.employeeName));
  }

  @Get('attendance/summary')
  async summary(
    @Req() req: AuthenticatedRequest,
    @Query() query: AttendanceSummaryQueryDto,
  ): Promise<MonthlyAttendanceSummaryResponse> {
    const result = await this.getAttendanceSummary.execute(
      new GetAttendanceSummaryQuery(req.firebaseUid!, query.companyId, query.branchId, query.month),
    );
    return toMonthlyAttendanceSummaryResponse(result);
  }

  @Post('attendance/apply-deductions')
  @HttpCode(HttpStatus.OK)
  async applyMonthDeductions(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApplyDeductionsDto,
  ): Promise<ApplyDeductionsResponse> {
    const result = await this.applyDeductions.execute(
      new ApplyMonthDeductionsCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.month, dto.employeeIds),
    );
    return toApplyDeductionsResponse(result);
  }
}
