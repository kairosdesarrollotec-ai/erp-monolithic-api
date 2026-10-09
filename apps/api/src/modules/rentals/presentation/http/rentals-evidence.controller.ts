import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from '../../../users/infrastructure/auth/firebase-auth.guard';
import { IdempotencyInterceptor } from '../../../../common/http/idempotency.interceptor';
import { RequestEvidenceUploadSessionHandler } from '../../application/commands/request-evidence-upload-session.handler';
import { RequestEvidenceUploadSessionCommand } from '../../application/commands/request-evidence-upload-session.command';
import { RecordEvidenceHandler } from '../../application/commands/record-evidence.handler';
import { RecordEvidenceCommand } from '../../application/commands/record-evidence.command';
import { ListRentalEvidenceHandler } from '../../application/queries/list-rental-evidence.handler';
import { ListRentalEvidenceQuery } from '../../application/queries/list-rental-evidence.query';
import { RequestEvidenceUploadSessionDto } from './dto/request-evidence-upload-session.dto';
import { EvidenceUploadSessionResponse } from './dto/evidence-upload-session.response';
import { RecordEvidenceDto } from './dto/record-evidence.dto';
import { RentalEvidenceResponse } from './dto/rental-evidence.response';

@Controller('rentals')
@UseGuards(FirebaseAuthGuard)
export class RentalsEvidenceController {
  constructor(
    private readonly requestEvidenceUploadSession: RequestEvidenceUploadSessionHandler,
    private readonly recordEvidence: RecordEvidenceHandler,
    private readonly listRentalEvidence: ListRentalEvidenceHandler,
  ) {}

  @Post(':id/evidence/upload-url')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async requestEvidenceUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestEvidenceUploadSessionDto,
  ): Promise<EvidenceUploadSessionResponse> {
    return this.requestEvidenceUploadSession.execute(
      new RequestEvidenceUploadSessionCommand(
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
  }

  @Post(':id/evidence')
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async recordEvidenceCommand(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEvidenceDto,
  ): Promise<RentalEvidenceResponse> {
    const record = await this.recordEvidence.execute(
      new RecordEvidenceCommand(id, req.firebaseUid!, dto.companyId, dto.branchId, dto.type, dto.zone, dto.objectUrl),
    );
    return {
      id: record.id,
      rentalId: record.rentalId,
      type: record.type,
      zone: record.zone,
      objectUrl: record.objectUrl,
      uploadedBy: record.uploadedBy,
      uploadedAt: record.uploadedAt.toISOString(),
    };
  }

  @Get(':id/evidence')
  async listEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('branchId', ParseUUIDPipe) branchId: string,
  ): Promise<RentalEvidenceResponse[]> {
    const records = await this.listRentalEvidence.execute(
      new ListRentalEvidenceQuery(id, req.firebaseUid!, companyId, branchId),
    );
    return records.map((record) => ({
      id: record.id,
      rentalId: record.rentalId,
      type: record.type,
      zone: record.zone,
      objectUrl: record.objectUrl,
      uploadedBy: record.uploadedBy,
      uploadedAt: record.uploadedAt.toISOString(),
    }));
  }
}
