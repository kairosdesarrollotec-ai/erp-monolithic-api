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
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestRentalDocumentUploadSessionHandler } from '../../application/commands/request-rental-document-upload-session.handler';
import { RecordRentalDocumentHandler } from '../../application/commands/record-rental-document.handler';
import { ListRentalDocumentsHandler } from '../../application/queries/list-rental-documents.handler';
import { RequestRentalDocumentUploadSessionDto } from './dto/request-rental-document-upload-session.dto';
import { RecordRentalDocumentDto } from './dto/record-rental-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { RentalDocumentRecord } from '../../application/ports/rental-document-repository.port';

@Controller('rentals/:id/documents')
@UseGuards(FirebaseAuthGuard)
export class RentalDocumentsController {
  constructor(
    private readonly requestDocumentUploadSession: RequestRentalDocumentUploadSessionHandler,
    private readonly recordDocument: RecordRentalDocumentHandler,
    private readonly listDocuments: ListRentalDocumentsHandler,
  ) {}

  @Post('upload-url')
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async requestDocumentUploadSessionEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestRentalDocumentUploadSessionDto,
  ): Promise<{ uploadUrl: string; objectUrl: string }> {
    return this.requestDocumentUploadSession.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      rentalId: id,
      documentType: dto.documentType,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  async recordDocumentEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordRentalDocumentDto,
  ): Promise<RentalDocumentRecord> {
    return this.recordDocument.execute({
      firebaseUid: req.firebaseUid!,
      companyId: dto.companyId,
      branchId: dto.branchId,
      rentalId: id,
      documentType: dto.documentType,
      objectUrl: dto.objectUrl,
    });
  }

  @Get()
  async listDocumentsEndpoint(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<RentalDocumentRecord[]> {
    return this.listDocuments.execute({
      firebaseUid: req.firebaseUid!,
      companyId: query.companyId,
      branchId: query.branchId,
      rentalId: id,
    });
  }
}
