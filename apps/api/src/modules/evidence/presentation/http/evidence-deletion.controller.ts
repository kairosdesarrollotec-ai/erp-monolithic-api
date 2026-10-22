import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedRequest, FirebaseAuthGuard } from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestEvidenceDeletionHandler } from '../../application/commands/request-evidence-deletion.handler';
import { RequestEvidenceDeletionCommand } from '../../application/commands/request-evidence-deletion.command';
import { ApproveEvidenceDeletionHandler } from '../../application/commands/approve-evidence-deletion.handler';
import { ApproveEvidenceDeletionCommand } from '../../application/commands/approve-evidence-deletion.command';
import { RejectEvidenceDeletionHandler } from '../../application/commands/reject-evidence-deletion.handler';
import { RejectEvidenceDeletionCommand } from '../../application/commands/reject-evidence-deletion.command';
import { ListEvidenceDeletionRequestsHandler } from '../../application/queries/list-evidence-deletion-requests.handler';
import { GetEvidenceDeletionRequestHandler } from '../../application/queries/get-evidence-deletion-request.handler';
import { GetEvidenceDeletionRequestQuery, ListEvidenceDeletionRequestsQuery } from '../../application/queries/evidence-deletion-queries';
import { toDeletionView } from '../../application/queries/evidence-deletion-view';
import {
  ApproveEvidenceDeletionDto,
  EvidenceDeletionScopeQueryDto,
  ListEvidenceDeletionQueryDto,
  RejectEvidenceDeletionDto,
  RequestEvidenceDeletionDto,
} from './dto/evidence-deletion.dto';
import type { EvidenceDeletionRequestResponse } from './dto/evidence-deletion.response';
import { toEvidenceDeletionResponse } from './evidence-deletion.mapper';

/**
 * DEC-EVID-DELETE-002 (Respuestas 2026-10-20 #35, SDD 15.5) - eliminacion de evidencia con DOBLE APROBACION. Los POST aceptan
 * `Idempotency-Key`. Errores `{statusCode, code, detail}`. Sustituye al DELETE directo de rentals / returns (DEPRECADO).
 */
@Controller('evidence/deletion-requests')
@UseGuards(FirebaseAuthGuard)
export class EvidenceDeletionController {
  constructor(
    private readonly requestDeletion: RequestEvidenceDeletionHandler,
    private readonly approveDeletion: ApproveEvidenceDeletionHandler,
    private readonly rejectDeletion: RejectEvidenceDeletionHandler,
    private readonly listRequests: ListEvidenceDeletionRequestsHandler,
    private readonly getRequest: GetEvidenceDeletionRequestHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async request(@Req() req: AuthenticatedRequest, @Body() dto: RequestEvidenceDeletionDto): Promise<EvidenceDeletionRequestResponse> {
    const record = await this.requestDeletion.execute(
      new RequestEvidenceDeletionCommand(req.firebaseUid!, dto.companyId, dto.branchId, dto.targetKind, dto.targetId, dto.evidenceId, dto.reason),
    );
    return toEvidenceDeletionResponse(toDeletionView(record, req.firebaseUid!, false, new Date()));
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListEvidenceDeletionQueryDto): Promise<EvidenceDeletionRequestResponse[]> {
    const views = await this.listRequests.execute(
      new ListEvidenceDeletionRequestsQuery(req.firebaseUid!, query.companyId, query.branchId, query.status, query.targetKind, query.limit),
    );
    return views.map(toEvidenceDeletionResponse);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EvidenceDeletionScopeQueryDto,
  ): Promise<EvidenceDeletionRequestResponse> {
    const view = await this.getRequest.execute(new GetEvidenceDeletionRequestQuery(req.firebaseUid!, query.companyId, query.branchId, id));
    return toEvidenceDeletionResponse(view);
  }

  /** 1a aprobacion -> APPROVED_1; 2a aprobacion (persona distinta del solicitante y del 1o) -> EXECUTED y borra la evidencia. */
  @Post(':id/approve')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveEvidenceDeletionDto,
  ): Promise<EvidenceDeletionRequestResponse> {
    const record = await this.approveDeletion.execute(new ApproveEvidenceDeletionCommand(req.firebaseUid!, dto.companyId, dto.branchId, id, dto.note));
    return toEvidenceDeletionResponse(toDeletionView(record, req.firebaseUid!, true, new Date()));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEvidenceDeletionDto,
  ): Promise<EvidenceDeletionRequestResponse> {
    const record = await this.rejectDeletion.execute(new RejectEvidenceDeletionCommand(req.firebaseUid!, dto.companyId, dto.branchId, id, dto.reason));
    return toEvidenceDeletionResponse(toDeletionView(record, req.firebaseUid!, true, new Date()));
  }
}
