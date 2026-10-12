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
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestLeaveCommand } from '../../application/commands/request-leave.command';
import { RequestLeaveHandler } from '../../application/commands/request-leave.handler';
import { ResolveLeaveCommand } from '../../application/commands/resolve-leave.command';
import { ResolveLeaveHandler } from '../../application/commands/resolve-leave.handler';
import { RequestLeaveEvidenceUploadSessionCommand } from '../../application/commands/request-leave-evidence-upload-session.command';
import { RequestLeaveEvidenceUploadSessionHandler } from '../../application/commands/request-leave-evidence-upload-session.handler';
import { RecordLeaveEvidenceCommand } from '../../application/commands/record-leave-evidence.command';
import { RecordLeaveEvidenceHandler } from '../../application/commands/record-leave-evidence.handler';
import { ListLeaveEvidenceQuery } from '../../application/queries/list-leave-evidence.query';
import { ListLeaveEvidenceHandler } from '../../application/queries/list-leave-evidence.handler';
import { GetEmployeeLeavesQuery } from '../../application/queries/get-employee-leaves.query';
import { GetEmployeeLeavesHandler } from '../../application/queries/get-employee-leaves.handler';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { ResolveLeaveDto } from './dto/resolve-leave.dto';
import { RequestLeaveEvidenceUploadSessionDto } from './dto/request-leave-evidence-upload-session.dto';
import { RecordLeaveEvidenceDto } from './dto/record-leave-evidence.dto';
import { parseDateOnly } from './dto/hr-date';
import type {
  LeaveEvidenceResponse,
  LeaveEvidenceUploadSessionResponse,
  LeaveRequestResponse,
} from './dto/hr-administration.response';
import { toLeaveEvidenceResponse, toLeaveRequestResponse } from './hr-administration.mapper';

@Controller()
@UseGuards(FirebaseAuthGuard)
export class LeavesController {
  constructor(
    private readonly requestLeave: RequestLeaveHandler,
    private readonly resolveLeave: ResolveLeaveHandler,
    private readonly getEmployeeLeaves: GetEmployeeLeavesHandler,
    private readonly requestEvidenceUpload: RequestLeaveEvidenceUploadSessionHandler,
    private readonly recordEvidence: RecordLeaveEvidenceHandler,
    private readonly listEvidence: ListLeaveEvidenceHandler,
  ) {}

  @Post('employees/:id/leaves')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async request(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestLeaveDto,
  ): Promise<LeaveRequestResponse> {
    const created = await this.requestLeave.execute(
      new RequestLeaveCommand(
        req.firebaseUid!,
        id,
        dto.type,
        parseDateOnly(dto.date),
        dto.reason,
        dto.startTime ? new Date(dto.startTime) : null,
        dto.endTime ? new Date(dto.endTime) : null,
      ),
    );
    return toLeaveRequestResponse(created);
  }

  @Get('employees/:id/leaves')
  async listByEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaveRequestResponse[]> {
    const result = await this.getEmployeeLeaves.execute(new GetEmployeeLeavesQuery(req.firebaseUid!, id));
    return result.items.map((l) => toLeaveRequestResponse(l, result.employeeName));
  }

  /** ADP-04: paso 1 de la evidencia adjunta — URL firmada de subida (mismo patrón que Devoluciones/Alquileres). */
  @Post('leaves/:id/evidence/upload-url')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async requestEvidenceUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestLeaveEvidenceUploadSessionDto,
  ): Promise<LeaveEvidenceUploadSessionResponse> {
    const session = await this.requestEvidenceUpload.execute(
      new RequestLeaveEvidenceUploadSessionCommand(req.firebaseUid!, id, dto.contentType, dto.contentLength),
    );
    return { uploadUrl: session.uploadUrl, objectUrl: session.objectUrl, expiresAt: session.expiresAt.toISOString() };
  }

  /** ADP-04: paso 2 — registra la evidencia ya subida y la adjunta al permiso. */
  @Post('leaves/:id/evidence')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async recordLeaveEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordLeaveEvidenceDto,
  ): Promise<LeaveEvidenceResponse> {
    const evidence = await this.recordEvidence.execute(
      new RecordLeaveEvidenceCommand(req.firebaseUid!, id, dto.objectUrl, dto.contentType),
    );
    return toLeaveEvidenceResponse(evidence);
  }

  @Get('leaves/:id/evidence')
  async listLeaveEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaveEvidenceResponse[]> {
    const items = await this.listEvidence.execute(new ListLeaveEvidenceQuery(req.firebaseUid!, id));
    return items.map(toLeaveEvidenceResponse);
  }

  @Patch('leaves/:id/resolve')
  async resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveLeaveDto,
  ): Promise<LeaveRequestResponse> {
    const resolved = await this.resolveLeave.execute(
      new ResolveLeaveCommand(req.firebaseUid!, id, dto.status, dto.resolutionNotes),
    );
    return toLeaveRequestResponse(resolved);
  }
}
