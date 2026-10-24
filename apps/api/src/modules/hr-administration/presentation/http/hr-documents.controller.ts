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
import { PublishHrDocumentHandler } from '../../application/commands/publish-hr-document.handler';
import { ListActiveHrDocumentsHandler } from '../../application/queries/list-active-hr-documents.handler';
import { ConfirmHrDocumentReadHandler } from '../../application/commands/confirm-hr-document-read.handler';
import { PublishHrDocumentCommand } from '../../application/commands/publish-hr-document.command';
import { ListActiveHrDocumentsQuery } from '../../application/queries/list-active-hr-documents.query';
import { ConfirmHrDocumentReadCommand } from '../../application/commands/confirm-hr-document-read.command';
import {
  ListActiveHrDocumentsQueryDto,
  PublishHrDocumentDto,
} from './dto/publish-hr-document.dto';
import {
  ActiveHrDocumentsListResponse,
  ConfirmHrDocumentReadResponse,
  HrDocumentResponse,
} from './dto/hr-administration.response';
import { toHrDocumentResponse } from './hr-administration.mapper';

@Controller('hr-documents')
@UseGuards(FirebaseAuthGuard)
export class HrDocumentsController {
  constructor(
    private readonly publishHandler: PublishHrDocumentHandler,
    private readonly listHandler: ListActiveHrDocumentsHandler,
    private readonly confirmReadHandler: ConfirmHrDocumentReadHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  async publish(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PublishHrDocumentDto,
  ): Promise<HrDocumentResponse> {
    const created = await this.publishHandler.execute(
      new PublishHrDocumentCommand(
        req.firebaseUid!,
        dto.companyId,
        '',
        dto.code,
        dto.title,
        dto.category,
        dto.fileUrl,
        dto.fileHash,
        dto.fileName,
        dto.mimeType,
        dto.sizeBytes,
      ),
    );
    return toHrDocumentResponse(created, { hasRead: false, readAt: null });
  }

  @Get('active')
  async listActive(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListActiveHrDocumentsQueryDto,
  ): Promise<ActiveHrDocumentsListResponse> {
    return this.listHandler.execute(
      new ListActiveHrDocumentsQuery(req.firebaseUid!, query.companyId, query.category),
    );
  }

  @Post(':id/confirm-read')
  @HttpCode(HttpStatus.OK)
  async confirmRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConfirmHrDocumentReadResponse> {
    return this.confirmReadHandler.execute(
      new ConfirmHrDocumentReadCommand(req.firebaseUid!, id),
    );
  }
}
