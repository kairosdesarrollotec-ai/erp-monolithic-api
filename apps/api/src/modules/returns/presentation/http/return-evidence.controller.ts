import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestReturnEvidenceUploadSessionHandler } from '../../application/commands/request-return-evidence-upload-session.handler';
import { RequestReturnEvidenceUploadSessionCommand } from '../../application/commands/request-return-evidence-upload-session.command';
import { RecordReturnEvidenceHandler } from '../../application/commands/record-return-evidence.handler';
import { RecordReturnEvidenceCommand } from '../../application/commands/record-return-evidence.command';
import { ListReturnEvidenceHandler } from '../../application/queries/list-return-evidence.handler';
import { ListReturnEvidenceQuery } from '../../application/queries/list-return-evidence.query';
import { RequestReturnEvidenceUploadSessionDto } from './dto/request-return-evidence-upload-session.dto';
import { RecordReturnEvidenceDto } from './dto/record-return-evidence.dto';
import { ReturnEvidenceResponse, ReturnEvidenceUploadSessionResponse } from './dto/return.response';
import { toReturnEvidenceResponse } from './return.mapper';

/** TR-08 / BR-DEV-009 - Evidencia fotográfica/video del checklist de retorno (patrón de 2 pasos: URL firmada -> registrar). */
@Controller('returns/:id/evidence')
@UseGuards(FirebaseAuthGuard)
export class ReturnEvidenceController {
  constructor(
    private readonly requestUploadSession: RequestReturnEvidenceUploadSessionHandler,
    private readonly recordEvidence: RecordReturnEvidenceHandler,
    private readonly listEvidence: ListReturnEvidenceHandler,
  ) {}

  @Post('upload-url')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async requestUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestReturnEvidenceUploadSessionDto,
  ): Promise<ReturnEvidenceUploadSessionResponse> {
    const session = await this.requestUploadSession.execute(
      new RequestReturnEvidenceUploadSessionCommand(
        id,
        req.firebaseUid!,
        dto.companyId,
        dto.branchId,
        dto.type,
        dto.zone,
        dto.contentType,
        dto.contentLength,
      ),
    );
    return {
      uploadUrl: session.uploadUrl,
      objectUrl: session.objectUrl,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async record(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordReturnEvidenceDto,
  ): Promise<ReturnEvidenceResponse> {
    const record = await this.recordEvidence.execute(
      new RecordReturnEvidenceCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, dto.type, dto.zone, dto.objectUrl),
    );
    return toReturnEvidenceResponse(record);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<ReturnEvidenceResponse[]> {
    const records = await this.listEvidence.execute(
      new ListReturnEvidenceQuery(id, req.firebaseUid!, companyId, branchId),
    );
    return records.map(toReturnEvidenceResponse);
  }
}
