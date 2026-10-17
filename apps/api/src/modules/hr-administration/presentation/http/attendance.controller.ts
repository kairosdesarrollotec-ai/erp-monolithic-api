import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { RecentAuth, RecentAuthGuard } from '../../../users/infrastructure/auth/recent-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { LogAttendanceCommand } from '../../application/commands/log-attendance.command';
import { LogAttendanceHandler } from '../../application/commands/log-attendance.handler';
import { ApplyMonthDeductionsCommand } from '../../application/commands/apply-month-deductions.command';
import { ApplyMonthDeductionsHandler } from '../../application/commands/apply-month-deductions.handler';
import { RequestAttendanceEvidenceUploadSessionCommand } from '../../application/commands/request-attendance-evidence-upload-session.command';
import { RequestAttendanceEvidenceUploadSessionHandler } from '../../application/commands/request-attendance-evidence-upload-session.handler';
import { ReclassifyAttendanceCommand } from '../../application/commands/reclassify-attendance.command';
import { ReclassifyAttendanceHandler } from '../../application/commands/reclassify-attendance.handler';
import { GetEmployeeAttendanceQuery } from '../../application/queries/get-employee-attendance.query';
import { GetEmployeeAttendanceHandler } from '../../application/queries/get-employee-attendance.handler';
import { GetAttendanceSummaryQuery } from '../../application/queries/get-attendance-summary.query';
import { GetAttendanceSummaryHandler } from '../../application/queries/get-attendance-summary.handler';
import { LogAttendanceDto } from './dto/log-attendance.dto';
import { GetEmployeeAttendanceQueryDto } from './dto/get-employee-attendance-query.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';
import { ApplyDeductionsDto } from './dto/apply-deductions.dto';
import { RequestAttendanceEvidenceUploadSessionDto } from './dto/request-attendance-evidence-upload-session.dto';
import { ReclassifyAttendanceDto } from './dto/reclassify-attendance.dto';
import { parseLimaLocalDateTime } from '../../../../common/time/lima-time';
import { parseDateOnly } from './dto/hr-date';
import type {
  ApplyDeductionsResponse,
  AttendanceEvidenceUploadSessionResponse,
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
    private readonly reclassifyAttendance: ReclassifyAttendanceHandler,
    private readonly getEmployeeAttendance: GetEmployeeAttendanceHandler,
    private readonly getAttendanceSummary: GetAttendanceSummaryHandler,
    private readonly requestEvidenceUpload: RequestAttendanceEvidenceUploadSessionHandler,
  ) {}

  @Post('employees/:id/attendance')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async log(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogAttendanceDto,
  ): Promise<AttendanceRecordResponse> {
    const { record, memo } = await this.logAttendance.execute(
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
        dto.evidence
          ? {
              kind: dto.evidence.kind,
              storageRef: dto.evidence.storageRef,
              url: dto.evidence.url,
              capturedAtLocal: parseLimaLocalDateTime(dto.evidence.capturedAtLocal),
              note: dto.evidence.note,
            }
          : null,
      ),
    );
    return toAttendanceRecordResponse(record, undefined, memo);
  }

  /**
   * DEC-ADP-ATT-EVIDENCE-002: paso 1 de la foto de asistencia — URL firmada de subida directa a GCS. La puede pedir el
   * propio colaborador (ficha vinculada a su cuenta por correo) o quien tenga LOG_ATTENDANCE. Paso 2: `log-attendance`
   * con `evidence.storageRef` = `storageRef` devuelto.
   */
  @Post('employees/:id/attendance/evidence/upload-url')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async requestEvidenceUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestAttendanceEvidenceUploadSessionDto,
  ): Promise<AttendanceEvidenceUploadSessionResponse> {
    const session = await this.requestEvidenceUpload.execute(
      new RequestAttendanceEvidenceUploadSessionCommand(req.firebaseUid!, id, dto.contentType, dto.contentLength),
    );
    return {
      uploadUrl: session.uploadUrl,
      objectUrl: session.objectUrl,
      storageRef: session.storageRef,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Patch('attendance/:id/reclassify')
  async reclassify(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReclassifyAttendanceDto,
  ): Promise<AttendanceRecordResponse> {
    const result = await this.reclassifyAttendance.execute(
      new ReclassifyAttendanceCommand(req.firebaseUid!, id, dto.status, dto.justification),
    );
    return toAttendanceRecordResponse(result.record, result.employeeName, result.memo);
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
  @UseGuards(RecentAuthGuard)
  @RecentAuth(300)
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
