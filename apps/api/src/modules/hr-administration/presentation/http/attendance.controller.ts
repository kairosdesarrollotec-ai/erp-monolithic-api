import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { LogMyAttendanceHandler } from '../../application/commands/log-my-attendance.handler';
import { ReviewAttendanceHandler } from '../../application/commands/review-attendance.handler';
import { ManageBranchGeofenceHandler } from '../../application/commands/manage-branch-geofence.handler';
import {
  BranchGeofenceRefCommand,
  LogMyAttendanceCommand,
  ReviewAttendanceCommand,
  SetBranchGeofenceCommand,
} from '../../application/commands/self-attendance.commands';
import {
  GetMyAttendanceHandler,
  ListAttendancePendingReviewHandler,
} from '../../application/queries/my-attendance.handlers';
import {
  BranchGeofenceQueryDto,
  LogMyAttendanceDto,
  MyAttendanceQueryDto,
  PendingReviewQueryDto,
  ReviewAttendanceDto,
  SetBranchGeofenceDto,
} from './dto/self-attendance.dto';
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
  BranchGeofenceResponse,
  MonthlyAttendanceSummaryResponse,
  MyAttendanceResponse,
} from './dto/hr-administration.response';
import {
  toApplyDeductionsResponse,
  toAttendanceRecordResponse,
  toBranchGeofenceResponse,
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
    private readonly logMyAttendance: LogMyAttendanceHandler,
    private readonly reviewAttendance: ReviewAttendanceHandler,
    private readonly branchGeofence: ManageBranchGeofenceHandler,
    private readonly getMyAttendance: GetMyAttendanceHandler,
    private readonly listPendingReview: ListAttendancePendingReviewHandler,
  ) {}

  /** 22-oct (#9): marca propia (entrada/salida) con foto, ubicacion y geocerca. */
  @Post('me/attendance')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async logMine(@Req() req: AuthenticatedRequest, @Body() dto: LogMyAttendanceDto): Promise<AttendanceRecordResponse> {
    const type = dto.type ?? 'CHECK_IN';
    const capturedAt = new Date(dto.capturedAt);
    const { record } = await this.logMyAttendance.execute(
      new LogMyAttendanceCommand(
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        type,
        dto.status ?? 'PRESENTE',
        dto.minutesLate,
        capturedAt,
        { latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy },
        dto.notes,
        dto.evidence
          ? {
              kind: dto.evidence.kind ?? 'SELF_PHOTO',
              storageRef: dto.evidence.storageRef,
              url: dto.evidence.url,
              // La foto se corrobora con la hora del dispositivo al marcar.
              capturedAtLocal: capturedAt,
              note: dto.evidence.note,
            }
          : null,
      ),
    );
    return toAttendanceRecordResponse(record);
  }

  @Get('me/attendance')
  async mine(@Req() req: AuthenticatedRequest, @Query() query: MyAttendanceQueryDto): Promise<MyAttendanceResponse> {
    const result = await this.getMyAttendance.execute({
      firebaseUid: req.firebaseUid!,
      companyId: query.companyId,
      branchId: query.branchId,
      month: query.month,
    });
    return {
      employeeId: result.employeeId,
      geofence: result.geofence,
      items: result.items.map((r) => toAttendanceRecordResponse(r)),
    };
  }

  @Get('attendance/pending-review')
  async pendingReview(
    @Req() req: AuthenticatedRequest,
    @Query() query: PendingReviewQueryDto,
  ): Promise<AttendanceRecordResponse[]> {
    const items = await this.listPendingReview.execute({
      firebaseUid: req.firebaseUid!,
      companyId: query.companyId,
      branchId: query.branchId,
      limit: query.limit,
    });
    return items.map((r) => toAttendanceRecordResponse(r, r.employee.fullName));
  }

  @Patch('attendance/:id/review')
  async review(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAttendanceDto,
  ): Promise<AttendanceRecordResponse> {
    const result = await this.reviewAttendance.execute(
      new ReviewAttendanceCommand(req.firebaseUid!, id, dto.decision, dto.note, dto.status, dto.minutesLate),
    );
    return toAttendanceRecordResponse(result.record, result.employeeName);
  }

  @Get('branches/:branchId/geofence')
  async getGeofence(
    @Req() req: AuthenticatedRequest,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() query: BranchGeofenceQueryDto,
  ): Promise<BranchGeofenceResponse> {
    return toBranchGeofenceResponse(
      await this.branchGeofence.get(new BranchGeofenceRefCommand(req.firebaseUid!, query.companyId, branchId)),
    );
  }

  @Put('branches/:branchId/geofence')
  async setGeofence(
    @Req() req: AuthenticatedRequest,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: SetBranchGeofenceDto,
  ): Promise<BranchGeofenceResponse> {
    return toBranchGeofenceResponse(
      await this.branchGeofence.set(
        new SetBranchGeofenceCommand(req.firebaseUid!, dto.companyId, branchId, dto.latitude, dto.longitude, dto.radiusMeters),
      ),
    );
  }

  @Delete('branches/:branchId/geofence')
  async clearGeofence(
    @Req() req: AuthenticatedRequest,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() query: BranchGeofenceQueryDto,
  ): Promise<BranchGeofenceResponse> {
    return toBranchGeofenceResponse(
      await this.branchGeofence.clear(new BranchGeofenceRefCommand(req.firebaseUid!, query.companyId, branchId)),
    );
  }

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
        // HU-29: ubicacion automatica opcional; si falta una de las dos coordenadas el handler responde 422.
        dto.latitude != null || dto.longitude != null
          ? { latitude: dto.latitude as number, longitude: dto.longitude as number, accuracy: dto.accuracy }
          : null,
        dto.reason,
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
